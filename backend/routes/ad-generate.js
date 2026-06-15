// routes/ad-generate.js  v5 — Pollinations.AI (FLUX, generación SECUENCIAL)
// ─────────────────────────────────────────────────────────────────────────────
//  Flujo primario:  Groq (llama-3.3-70b) → prompts creativos
//                   Pollinations.AI FLUX  → imágenes publicitarias, UNA A LA VEZ
//  Flujo fallback:  Groq → JSON specs → Canvas en el frontend
//
//  Cambios v5:
//    • Generación SECUENCIAL (no paralela): cada imagen espera a que la
//      anterior termine completamente antes de iniciar. Esto respeta el
//      límite de Pollinations "max 1 request queued" sin necesidad de
//      stagger artificial ni retries por 402.
//    • Se mantiene retry en timeout (AbortError) por robustez de red.
//    • Tiempo total esperado: ~10-15s por imagen × 3 = 30-45s.
//
//  Variables de entorno necesarias:
//    GROQ_API_KEY        — obligatorio
//    POLLINATIONS_TOKEN  — configurado ✓
// ─────────────────────────────────────────────────────────────────────────────

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

// ── 1. Groq → prompt creativo (optimizado para URL, max ~250 chars) ───────────

async function generateImagePrompt(groqKey, { offerName, offerType, title, tagline, cta, productName, style }) {
    const badge = offerType === '2x1' ? '2×1'
        : offerType === '3x2' ? '3×2'
            : offerType === '50%' ? '50% OFF'
                : offerType || '';

    const userPrompt = `You are a creative director for retail advertising.
Write a SHORT image-generation prompt (max 250 characters, no explanations).

Ad details:
- Product: "${productName}"
- Promotion: "${offerName}"${badge ? ` (badge: "${badge}")` : ''}
- Headline: "${title || offerName}"
- Style: ${STYLE_GUIDES[style]}

Describe: product prominently centered, bold headline text, ${badge ? `"${badge}" promotional badge, ` : ''}${STYLE_GUIDES[style]}, high quality professional retail ad, portrait format.

RESPOND ONLY WITH THE PROMPT IN ENGLISH. NO EXPLANATION. MAX 250 CHARACTERS.`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 120,         // prompts cortos para URL segura
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

// ── 2. Pollinations.AI → imagen FLUX ──────────────────────────────────────────
//
//  Pollinations limita a 1 request "en cola" (procesándose) por IP a la vez.
//  Por eso esta función se llama SECUENCIALMENTE desde el endpoint — no hay
//  delays artificiales, solo se espera a que cada fetch complete.
//
//  Retry automático en timeout (AbortError): espera 4s y reintenta una vez.
//  Si llega un 402 de todos modos (poco probable en modo secuencial), también
//  se reintenta una vez tras 8s, por robustez.

async function generateImage(prompt, format, retriesLeft = 1) {
    const sizes = {
        square: { width: 1024, height: 1024 },
        story: { width: 768, height: 1360 },
        banner: { width: 1360, height: 768 },
    };
    const { width, height } = sizes[format] ?? sizes.square;

    // Truncar prompt a 480 chars para URL segura (encoded puede triplicar longitud)
    const safePrompt = prompt.slice(0, 480);
    const seed = Math.floor(Math.random() * 999999) + 1;
    const token = process.env.POLLINATIONS_TOKEN;

    const params = new URLSearchParams({
        width: String(width),
        height: String(height),
        model: 'flux',
        seed: String(seed),
        nologo: 'true',
    });

    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(safePrompt)}?${params}`;

    const headers = {
        'User-Agent': 'AdCreator/5.0',
        'Authorization': `Bearer ${token}`,
    };

    // Timeout de 25s por imagen
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    try {
        console.log(`[Pollinations] Generando imagen ${width}×${height} (seed:${seed})…`);

        const res = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const errText = await res.text().catch(() => '');

            // Reintento en caso de 402 — poco probable en modo secuencial,
            // pero por robustez si la cola tardó en liberarse.
            if (res.status === 402 && retriesLeft > 0) {
                console.warn(`[Pollinations] 402 Queue full — reintentando en 8s… (${retriesLeft} intento(s) restante(s))`);
                await sleep(8_000);
                return generateImage(prompt, format, retriesLeft - 1);
            }

            throw new Error(`Pollinations error (${res.status}): ${errText.slice(0, 200)}`);
        }

        const contentType = res.headers.get('content-type') ?? 'image/jpeg';
        const buffer = await res.arrayBuffer();

        if (buffer.byteLength < 1000) {
            throw new Error('Pollinations devolvió respuesta demasiado pequeña (posible error)');
        }

        const base64 = Buffer.from(buffer).toString('base64');
        console.log(`[Pollinations] ✓ imagen lista (${Math.round(buffer.byteLength / 1024)} KB)`);

        return {
            imageBase64: base64,
            mimeType: contentType.split(';')[0].trim(),
        };

    } catch (err) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            if (retriesLeft > 0) {
                console.warn('[Pollinations] timeout — reintentando en 4s…');
                await sleep(4_000);
                return generateImage(prompt, format, retriesLeft - 1);
            }
            throw new Error('Pollinations timeout: la imagen tardó más de 25s');
        }
        throw err;
    }
}

// ── 3. Groq → Canvas specs JSON (fallback, sin cambios) ──────────────────────

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
        console.error('[ad-generate-specs] JSON inválido:', parseErr.message, '\nRaw:', raw.slice(0, 500));
        throw new Error('La IA no generó un formato válido. Intenta de nuevo.');
    }
}

// ── Endpoint principal: /ad-generate ─────────────────────────────────────────
//
//  Timeline esperado (generación SECUENCIAL):
//    t=0s    → Groq genera 3 prompts en paralelo          (~2s)
//    t=2s    → imagen "vibrant" arranca, ~10-15s
//    t=12-17s → imagen "elegant" arranca, ~10-15s
//    t=22-32s → imagen "minimal" arranca, ~10-15s
//    t=32-47s → res.json() enviado al cliente
//
//  En Render free tier (timeout ~30s en requests HTTP) esto puede no alcanzar
//  a completar las 3 imágenes. Si eso ocurre en producción, considera reducir
//  a 2 variantes o usar el fallback Canvas como primario en ese entorno.

router.post('/ad-generate', async (req, res) => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return res.status(500).json({ error: 'GROQ_API_KEY no configurada en .env' });

    const pollinationsToken = process.env.POLLINATIONS_TOKEN;
    if (!pollinationsToken) return res.status(500).json({ error: 'POLLINATIONS_TOKEN no configurado en .env' });

    const { offerName, offerType, title, tagline, cta, productName, format } = req.body;
    if (!offerName) return res.status(400).json({ error: 'offerName es requerido' });

    console.log('[ad-generate] Iniciando generación (con token Pollinations, 3 variantes, SECUENCIAL)…');

    try {
        // ── Paso 1: 3 prompts creativos en paralelo con Groq (~2s) ─────────
        console.log('[ad-generate] Paso 1 — generando prompts con Groq…');
        const prompts = await Promise.all(
            STYLE_VARIANTS.map(style =>
                generateImagePrompt(groqKey, { offerName, offerType, title, tagline, cta, productName, style })
            )
        );

        prompts.forEach((p, i) =>
            console.log(`[ad-generate] Prompt "${STYLE_VARIANTS[i]}": ${p.slice(0, 80)}…`)
        );

        // ── Paso 2: imágenes con Pollinations.AI — UNA A LA VEZ ─────────────
        //  Se itera secuencialmente con un for...of + await. Si una falla,
        //  se registra el error pero se continúa con la siguiente.
        console.log('[ad-generate] Paso 2 — generando imágenes secuencialmente…');

        const variants = [];
        const errors = [];

        for (let i = 0; i < prompts.length; i++) {
            const style = STYLE_VARIANTS[i];
            const prompt = prompts[i];

            try {
                const img = await generateImage(prompt, format ?? 'square');
                console.log(`[ad-generate] ✓ "${style}" lista`);
                variants.push({ ...img, style, prompt });
            } catch (err) {
                console.warn(`[ad-generate] ✗ "${style}" falló:`, err.message);
                errors.push(`${style}: ${err.message}`);
            }
        }

        if (variants.length === 0) {
            return res.status(502).json({
                error: 'No se pudo generar ninguna imagen. ' + (errors.join('; ') || 'Error desconocido'),
            });
        }

        console.log(`[ad-generate] ${variants.length}/${STYLE_VARIANTS.length} variantes listas ✓`);
        res.json({
            variants,
            partial: variants.length < STYLE_VARIANTS.length,
        });

    } catch (err) {
        console.error('[ad-generate] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Endpoint fallback: /ad-generate-specs (Canvas local) ─────────────────────

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
                        console.log(`[ad-generate-specs] ✓ specs "${style}" listos`);
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