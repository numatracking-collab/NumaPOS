// routes/ad-generate.js
// Flujo primario:  Groq (llama-3.3-70b, gratis) → prompt creativo
//                  HuggingFace FLUX.1-schnell    → imagen publicitaria
// Flujo fallback:  Groq → JSON specs             → Canvas en el frontend
// Features:        Reintentos con backoff · Generación paralela · Resultados parciales
// Devuelve:        { variants: [{ style, imageBase64, mimeType, prompt }], partial }

import express from 'express';

const router = express.Router();

const STYLE_VARIANTS = ['vibrant', 'elegant', 'minimal'];

const STYLE_GUIDES = {
    vibrant: 'ultra-saturated neon colors, magenta, yellow, cyan, high energy, colorful bokeh, dynamic light beams, vivid retail advertisement',
    elegant: 'deep black background, gold and cream accents, luxury feel, soft bokeh, sophisticated, premium retail advertisement',
    minimal: 'white background, single soft accent color, clean layout, lots of whitespace, modern typographic retail advertisement',
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ── 1. Groq genera el prompt creativo para imagen ────────────────────────────

async function generateImagePrompt(groqKey, { offerName, offerType, title, tagline, cta, productName, style }) {
    const badge = offerType === '2x1' ? '2×1'
        : offerType === '3x2' ? '3×2'
            : offerType === '50%' ? '50% OFF'
                : offerType || '';

    const userPrompt = `You are a creative director for retail digital advertising.
Write a single detailed image-generation prompt (no explanations, no markdown, just the prompt text).

Advertisement details:
- Product: "${productName}"
- Promotion: "${offerName}"${badge ? ` (badge: "${badge}")` : ''}
- Headline: "${title || 'generate a catchy short headline in Spanish'}"
- Tagline: "${tagline || 'generate a persuasive short tagline in Spanish'}"
- CTA button: "${cta}"
- Visual style: ${STYLE_GUIDES[style]}

The prompt must describe:
1. The product prominently centered on a styled background
2. Large bold headline text at the bottom: "${title || offerName}"
3. Smaller tagline text below the headline
4. A CTA button labeled "${cta}"
${badge ? `5. A promotional badge "${badge}" in the upper corner` : ''}
6. Style: ${STYLE_GUIDES[style]}
7. High quality, professional retail advertising, portrait format

Respond ONLY with the prompt text in English.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 512,
            temperature: 0.9,
            messages: [{ role: 'user', content: userPrompt }],
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Groq error (${res.status}): ${err.error?.message ?? JSON.stringify(err)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ── 2. HuggingFace FLUX.1-schnell genera la imagen (con reintentos) ──────────

async function generateImage(hfToken, prompt, format) {
    const sizes = {
        square: { width: 1024, height: 1024 },
        story:  { width: 768,  height: 1360 },
        banner: { width: 1360, height: 768  },
    };
    const { width, height } = sizes[format] ?? sizes.square;

    const MAX_RETRIES = 2;
    const RETRY_DELAYS = [8000, 20000];
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            console.log(`[HF] Reintento ${attempt}/${MAX_RETRIES} en ${RETRY_DELAYS[attempt - 1] / 1000}s…`);
            await sleep(RETRY_DELAYS[attempt - 1]);
        }

        try {
            const res = await fetch(
                // ← Nuevo dominio router + formato bytes directo (igual que antes pero nueva URL)
                'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${hfToken}`,
                        'x-wait-for-model': 'true', // ← evita 503 de modelo cargando
                    },
                    body: JSON.stringify({
                        inputs: prompt,
                        parameters: { width, height, num_inference_steps: 4 },
                    }),
                }
            );

            if (res.status === 503 || res.status === 429) {
                const errText = await res.text();
                console.warn(`[HF] ${res.status}: ${errText.slice(0, 120)}`);
                lastError = new Error(`HuggingFace ${res.status}: modelo ocupado`);
                continue;
            }

            if (!res.ok) {
                const errText = await res.text();
                console.error(`[HF] Status: ${res.status} — Body:`, errText.slice(0, 300));
                throw new Error(`HuggingFace error (${res.status}): ${errText.slice(0, 200)}`);
            }

            const contentType = res.headers.get('content-type') ?? '';

            // El endpoint devuelve bytes de imagen directamente
            if (contentType.startsWith('image/')) {
                const buffer = await res.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                return { imageBase64: base64, mimeType: contentType };
            }

            // Algunos casos devuelven JSON con base64
            if (contentType.includes('application/json')) {
                const data = await res.json();
                // Formato: { image: "base64..." } o [{ generated_image: "..." }]
                const b64 = data.image ?? data[0]?.generated_image ?? data.data?.[0]?.b64_json;
                if (!b64) throw new Error('HuggingFace: respuesta JSON sin imagen');
                return { imageBase64: b64, mimeType: 'image/jpeg' };
            }

            throw new Error(`HuggingFace: content-type inesperado: ${contentType}`);

        } catch (err) {
            lastError = err;
            if (!err.message?.includes('modelo ocupado')) throw err;
        }
    }

    throw lastError;
}

// ── 3. Groq genera specs JSON para Canvas (fallback) ─────────────────────────

async function generateCanvasSpecs(groqKey, { offerName, offerType, title, tagline, cta, productName, style }) {
    const badge = offerType === '2x1' ? '2×1'
        : offerType === '3x2' ? '3×2'
            : offerType === '50%' ? '50% OFF'
                : offerType || '';

    const styleGuide = STYLE_GUIDES[style] || STYLE_GUIDES.vibrant;

    const systemPrompt = `You are a creative director. Generate a JSON specification for a canvas-based retail advertisement.
The JSON must have exactly 3 top-level fields: "bgSpec", "textSpec", "contextualDecor".

## bgSpec (background)
{
  "type": "gradient" or "radial",
  "colors": ["#hex1", "#hex2", "#hex3"],
  "x0": 0, "y0": 0, "x1": 1, "y1": 1,
  "shapes": [
    { "type": "bokeh", "count": 10, "maxR": 0.06, "opacity": 0.18, "color": "#hex", "seed": 42 },
    { "type": "spotlight", "cx": 0.5, "cy": -0.1, "r": 0.7, "opacity": 0.1, "color": "#ffffff" },
    { "type": "circle", "cx": 0.3, "cy": 0.5, "r": 0.15, "color": "#hex", "opacity": 0.1 }
  ]
}

## textSpec (text, headline, badges)
{
  "headline": "Short catchy headline in Spanish (max 6 words)",
  "tagline": "Persuasive tagline in Spanish (max 15 words)",
  "cta": "CTA button text",
  "headlineColor": "#ffffff",
  "headlineGradient": ["#color1", "#color2", "#color3"],
  "taglineColor": "rgba(255,255,255,0.75)",
  "ctaColor": "#ffffff",
  "ctaBg": "#hex or null",
  "badgeText": "badge text or null",
  "badgeBg": "#hex",
  "badgeStyle": "simple" or "decorative",
  "accentLine": "#hex or null"
}

## contextualDecor (2-5 decorative elements)
[
  { "type": "sparkle", "layer": "front", "x": 0.85, "y": 0.15, "size": 0.06, "opacity": 0.7, "color": "#FFD700" },
  { "type": "star", "layer": "bg", "x": 0.1, "y": 0.2, "size": 0.12, "opacity": 0.4, "color": "#FFE566", "color2": "#C9A227" }
]
Supported types: "sparkle" (4-point glint), "star" (5-point star), "sportsball" (soccer ball).

IMPORTANT:
- If headline/tagline/cta text is provided, use it EXACTLY as given.
- Only generate text for fields where the user hasn't provided content.
- All colors must be valid CSS hex colors.
- Respond ONLY with the raw JSON object. No markdown, no code fences, no explanation.`;

    const userPrompt = `Design a "${style}" style advertisement:
- Product: "${productName}"
- Promotion: "${offerName}"${badge ? ` (badge: "${badge}")` : ''}
- Headline: ${title ? `"${title}" (USE EXACTLY)` : 'Generate a catchy short headline in Spanish'}
- Tagline: ${tagline ? `"${tagline}" (USE EXACTLY)` : 'Generate a persuasive short tagline in Spanish'}
- CTA: "${cta}" (USE EXACTLY)
${badge ? `- Badge text: "${badge}"` : '- No badge needed'}
- Visual style guide: ${styleGuide}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 1024,
            temperature: 0.85,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Groq error (${res.status}): ${err.error?.message ?? JSON.stringify(err)}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';

    // Limpiar posibles fences de markdown
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    try {
        const specs = JSON.parse(cleaned);
        if (!specs.bgSpec || !specs.textSpec) {
            throw new Error('Campos requeridos faltantes en el JSON');
        }
        return {
            bgSpec: specs.bgSpec,
            textSpec: specs.textSpec,
            contextualDecor: specs.contextualDecor || [],
        };
    } catch (parseErr) {
        console.error('[ad-generate-specs] Error parseando JSON:', parseErr.message, '\nRaw:', raw.slice(0, 500));
        throw new Error('La IA no generó un formato válido. Intenta de nuevo.');
    }
}

// ── Endpoint principal: imágenes con IA ──────────────────────────────────────

router.post('/ad-generate', async (req, res) => {
    const groqKey = process.env.GROQ_API_KEY;
    const hfToken = process.env.HF_TOKEN;

    if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY no configurada en .env' });
    if (!hfToken) return res.status(500).json({ error: 'HF_TOKEN no configurada en .env' });

    const { offerName, offerType, title, tagline, cta, productName, format } = req.body;
    if (!offerName) return res.status(400).json({ error: 'offerName es requerido' });

    try {
        console.log('[ad-generate] Generando 3 variantes en paralelo…');

        // Paso 1 — Generar los 3 prompts en paralelo con Groq
        const prompts = await Promise.all(
            STYLE_VARIANTS.map(style => {
                console.log(`[ad-generate] Solicitando prompt "${style}"…`);
                return generateImagePrompt(groqKey, {
                    offerName, offerType, title, tagline, cta, productName, style,
                });
            })
        );

        prompts.forEach((p, i) =>
            console.log(`[ad-generate] Prompt (${STYLE_VARIANTS[i]}):`, p.slice(0, 80) + '…')
        );

        // Paso 2 — Generar las 3 imágenes en paralelo con HuggingFace
        const imageResults = await Promise.allSettled(
            prompts.map((prompt, i) =>
                generateImage(hfToken, prompt, format ?? 'square')
                    .then(img => {
                        console.log(`[ad-generate] Imagen "${STYLE_VARIANTS[i]}" generada ✓`);
                        return { ...img, style: STYLE_VARIANTS[i], prompt };
                    })
            )
        );

        // Recolectar resultados exitosos
        const variants = imageResults
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value);

        // Log errores parciales
        imageResults
            .filter(r => r.status === 'rejected')
            .forEach(r => console.warn(`[ad-generate] Falló variante:`, r.reason?.message));

        if (variants.length === 0) {
            const reasons = imageResults
                .filter(r => r.status === 'rejected')
                .map(r => r.reason?.message)
                .join('; ');
            return res.status(502).json({
                error: 'No se pudo generar ninguna imagen. ' + (reasons || 'Error desconocido'),
            });
        }

        console.log(`[ad-generate] ${variants.length}/${STYLE_VARIANTS.length} variantes generadas ✓`);
        res.json({
            variants,
            partial: variants.length < STYLE_VARIANTS.length,
        });

    } catch (err) {
        console.error('[ad-generate] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Endpoint fallback: specs JSON para Canvas ────────────────────────────────

router.post('/ad-generate-specs', async (req, res) => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY no configurada en .env' });

    const { offerName, offerType, title, tagline, cta, productName } = req.body;
    if (!offerName) return res.status(400).json({ error: 'offerName es requerido' });

    try {
        console.log('[ad-generate-specs] Generando specs Canvas con Groq…');

        const specs = await Promise.all(
            STYLE_VARIANTS.map(style =>
                generateCanvasSpecs(groqKey, { offerName, offerType, title, tagline, cta, productName, style })
                    .then(spec => {
                        console.log(`[ad-generate-specs] Specs "${style}" generados ✓`);
                        return { style, ...spec };
                    })
            )
        );

        console.log(`[ad-generate-specs] ${specs.length} specs generados ✓`);
        res.json({ variants: specs });

    } catch (err) {
        console.error('[ad-generate-specs] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

export default router;