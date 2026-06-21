/* ═══════════════════════════════════════════════════════════════════════════
   AdCreatorModal.jsx — Generador de publicidad con IA + Canvas
   ─────────────────────────────────────────────────────────────────────────
   ⚠️ Módulo en desarrollo: el modal se abre y muestra el aviso de
   "en construcción" en vez de ejecutar la generación con IA/Canvas.
   La implementación completa (pasos, generación, composición, descarga)
   queda comentada al final de este archivo para retomarla más adelante.
═══════════════════════════════════════════════════════════════════════════ */

import OnDevelopment from '../OnDevelopment';

export default function AdCreatorModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ width: '100%', maxWidth: '480px', minWidth: '320px', maxHeight: '92vh' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                    <h2 className="text-[17px] font-bold text-gray-900 flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            auto_awesome
                        </span>
                        Crear Publicidad con IA
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                        aria-label="Cerrar"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto" style={{ minHeight: 360 }}>
                    <OnDevelopment
                        title="¡La publicidad con IA ya casi está lista!"
                        message="Estamos trabajando en el desarrollo de este módulo, lo podrás utilizar muy pronto."
                    />
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-purple-600 text-white rounded-xl text-[13px] font-bold hover:bg-purple-700 transition-all active:scale-95"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IMPLEMENTACIÓN ORIGINAL — conservada para retomar cuando el módulo de
   generación de publicidad con IA esté listo para producción.

   Incluye: pasos (mensaje/formato/generación), llamadas a /api/ai/ad-generate
   y /api/ai/ad-generate-specs, composición con Canvas (fondo, decoraciones
   contextuales, eliminación de fondo del producto, texto con gradientes),
   y descarga de las 3 variantes generadas.

import { useState, useEffect, useCallback } from 'react';

// ─── Constantes ───────────────────────────────────────────────────────────────

const FORMATS = [
    { id: 'square', label: 'Cuadrado', desc: 'Instagram Post', ratio: '1 : 1', w: 1080, h: 1080, icon: 'crop_square' },
    { id: 'story', label: 'Historia', desc: 'Instagram / FB Story', ratio: '9 : 16', w: 1080, h: 1920, icon: 'crop_portrait' },
    { id: 'banner', label: 'Banner', desc: 'Facebook / Web', ratio: '16 : 9', w: 1920, h: 1080, icon: 'crop_landscape' },
];

const CTA_OPTIONS = [
    '¡Aprovecha ya!',
    'Solo hoy',
    '¡No te lo pierdas!',
    'Válido esta semana',
    '¡Corre, es por tiempo limitado!',
];

const STYLE_VARIANTS = [
    {
        id: 'vibrant',
        label: 'Vibrante',
        desc: 'Colores intensos y energéticos',
        guide: `Usa colores MUY saturados y contrastantes: magenta, amarillo neón, cyan brillante, rojo coral.
Alta energía, bokeh colorido (colores contrastantes). Spotlight blanco suave desde arriba.
headlineGradient: amarillo neón → naranja → magenta (ej. ["#FFE600","#FF6B00","#FF2D78"]).
Badge decorative con badgeBg neón. CTA con fondo de color vivo. Shapes geométricos grandes.`,
    },
    {
        id: 'elegant',
        label: 'Elegante',
        desc: 'Sofisticado y premium',
        guide: `Paleta oscura y sofisticada: negro profundo (#0A0A0A), dorado (#C9A227), crema (#F5F0E8).
Gradiente oscuro diagonal. Bokeh dorado suave (opacity 0.15-0.22). Spotlight blanco tenue.
headlineGradient: dorado brillante → ámbar → dorado pálido (["#FFF0A0","#FFD700","#C9A227","#FFF0A0"]).
Badge decorative con gradiente dorado. accentLine dorada. CTA sobre fondo negro.`,
    },
    {
        id: 'minimal',
        label: 'Minimalista',
        desc: 'Limpio y directo',
        guide: `Fondo blanco (#FFFFFF) o gris muy claro (#F4F4F2). Un color acento suave (azul #4A9EFF o menta #5CC8A0).
Sin bokeh. Un spotlight muy sutil. headlineGradient: del acento a una versión 30% más oscura.
Badge simple (badgeStyle: "simple") con el color acento. Texto oscuro (#111111) para tagline.
Sin formas decorativas recargadas. Máximo 2 shapes en bgSpec.`,
    },
];

// ─── Utilidades ───────────────────────────────────────────────────────────────

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
            const proxy = new Image();
            proxy.crossOrigin = 'anonymous';
            proxy.onload = () => resolve(proxy);
            proxy.onerror = () => reject(new Error('No se pudo cargar la imagen del producto'));
            proxy.src = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        };
        img.src = url;
    });
}

function removeBackground(img) {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
    const d = imageData.data;
    const samples = [[0, 0], [SIZE - 1, 0], [0, SIZE - 1], [SIZE - 1, SIZE - 1], [SIZE >> 1, 0], [0, SIZE >> 1]];
    const sum = samples.reduce((acc, [x, y]) => {
        const i = (y * SIZE + x) * 4;
        return { r: acc.r + d[i], g: acc.g + d[i + 1], b: acc.b + d[i + 2] };
    }, { r: 0, g: 0, b: 0 });
    const n = samples.length;
    const br = Math.round(sum.r / n), bg = Math.round(sum.g / n), bb = Math.round(sum.b / n);
    for (let i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) < 130) d[i + 3] = 0;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// ─── Primitivas de dibujo ─────────────────────────────────────────────────────

function seededRnd(seed) {
    let s = (Math.abs(seed ^ 0x5f3759df) || 1) >>> 0;
    return () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}

function drawStar(ctx, cx, cy, outerR, innerR, points, color) {
    innerR = innerR ?? outerR * 0.42;
    points = points ?? 5;
    if (color) ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const a = (i * Math.PI) / points - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
            : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
}

function drawSparkle(ctx, cx, cy, size, color) {
    ctx.save();
    ctx.fillStyle = color || '#ffffff';
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(
            cx + Math.cos(a) * size * 0.45,
            cy + Math.sin(a) * size * 0.45,
            size * 0.075, size * 0.5, a, 0, Math.PI * 2
        );
        ctx.fill();
    }
    ctx.restore();
}

function _polygon(ctx, cx, cy, r, sides, startAngle) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const a = (startAngle ?? -Math.PI / 2) + (i * Math.PI * 2) / sides;
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
            : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
}

function drawSoccerBall(ctx, cx, cy, r) {
    const gr = ctx.createRadialGradient(cx - r * .28, cy - r * .28, r * .04, cx, cy, r);
    gr.addColorStop(0, '#d2d2b4');
    gr.addColorStop(0.5, '#8a8a6e');
    gr.addColorStop(1, '#353528');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = r * 0.018;
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,12,0.75)';
    _polygon(ctx, cx, cy, r * .3, 5, -Math.PI / 2); ctx.fill();
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        _polygon(ctx, cx + Math.cos(a) * r * .56, cy + Math.sin(a) * r * .56, r * .21, 5, a + Math.PI / 5);
        ctx.fill();
    }
}

// ─── Fondo ────────────────────────────────────────────────────────────────────

function drawBackground(ctx, W, H, bg) {
    const colors = bg.colors || ['#6750A4', '#9C84D4'];
    if (bg.type === 'radial') {
        const gr = ctx.createRadialGradient(W * .5, H * .4, 0, W * .5, H * .5, W * .85);
        colors.forEach((c, i) => gr.addColorStop(i / Math.max(colors.length - 1, 1), c));
        ctx.fillStyle = gr;
    } else if (bg.type === 'solid') {
        ctx.fillStyle = colors[0];
    } else {
        const gr = ctx.createLinearGradient(W * (bg.x0 ?? 0), H * (bg.y0 ?? 0), W * (bg.x1 ?? 1), H * (bg.y1 ?? 1));
        colors.forEach((c, i) => gr.addColorStop(i / Math.max(colors.length - 1, 1), c));
        ctx.fillStyle = gr;
    }
    ctx.fillRect(0, 0, W, H);

    (bg.shapes || []).forEach(s => {
        ctx.save();
        if (s.type === 'bokeh') {
            const rand = seededRnd(s.seed ?? 42);
            const count = s.count || 10;
            const toHex = v => Math.round(Math.min(1, v) * 255).toString(16).padStart(2, '0');
            for (let b = 0; b < count; b++) {
                const bx = rand(), by = rand();
                const br = Math.min(W, H) * (s.maxR || .05) * (.2 + rand() * .8);
                const alpha = (s.opacity || .15) * (.4 + rand() * .6);
                const gr2 = ctx.createRadialGradient(W * bx, H * by, 0, W * bx, H * by, br);
                gr2.addColorStop(0, (s.color || '#ffffff') + toHex(alpha));
                gr2.addColorStop(.4, (s.color || '#ffffff') + toHex(alpha * .35));
                gr2.addColorStop(1, (s.color || '#ffffff') + '00');
                ctx.globalAlpha = 1;
                ctx.fillStyle = gr2;
                ctx.beginPath();
                ctx.arc(W * bx, H * by, br, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (s.type === 'spotlight') {
            const toHex = v => Math.round(Math.min(1, v) * 255).toString(16).padStart(2, '0');
            const gr2 = ctx.createRadialGradient(
                W * (s.cx || .5), H * (s.cy ?? -.1), 0,
                W * (s.cx || .5), H * (s.cy ?? -.1), Math.min(W, H) * (s.r || .7)
            );
            gr2.addColorStop(0, (s.color || '#ffffff') + toHex(s.opacity || .08));
            gr2.addColorStop(.6, (s.color || '#ffffff') + toHex((s.opacity || .08) * .2));
            gr2.addColorStop(1, (s.color || '#ffffff') + '00');
            ctx.globalAlpha = 1;
            ctx.fillStyle = gr2;
            ctx.fillRect(0, 0, W, H);
        } else {
            ctx.globalAlpha = s.opacity ?? .12;
            ctx.fillStyle = s.color || '#ffffff';
            if (s.type === 'circle') {
                ctx.beginPath();
                ctx.arc(W * s.cx, H * s.cy, Math.min(W, H) * s.r, 0, Math.PI * 2);
                ctx.fill();
            } else if (s.type === 'rect') {
                ctx.translate(W * s.cx, H * s.cy);
                ctx.rotate(((s.angle || 0) * Math.PI) / 180);
                ctx.fillRect(-W * (s.rw || .3) / 2, -H * (s.rh || .3) / 2, W * (s.rw || .3), H * (s.rh || .3));
            } else if (s.type === 'wave') {
                ctx.beginPath();
                ctx.moveTo(0, H * s.y);
                for (let x = 0; x <= W; x += 8)
                    ctx.lineTo(x, H * s.y + Math.sin(x / (W * .12) + (s.phase || 0)) * H * (s.amp || .05));
                ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
            }
        }
        ctx.restore();
    });
}

// ─── Helpers de texto ─────────────────────────────────────────────────────────

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
    if (!text) return;
    const words = text.split(' '); let line = '', ty = y;
    words.forEach(word => {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line, x, ty); line = word; ty += lineH;
        } else line = test;
    });
    if (line) ctx.fillText(line, x, ty);
}

function countLines(ctx, text, maxW, font) {
    const saved = ctx.font; ctx.font = font;
    const words = (text || '').split(' '); let line = '', count = 1;
    words.forEach(word => {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxW && line) { count++; line = word; } else line = test;
    });
    ctx.font = saved; return count;
}

// ─── Zona de texto ────────────────────────────────────────────────────────────

function drawText(ctx, W, H, ts, format) {
    const {
        headline,
        tagline,
        cta,
        headlineColor = '#ffffff',
        headlineGradient = null,
        taglineColor = '#ffffffbb',
        ctaColor = '#ffffff',
        ctaBg = null,
        badgeText = null,
        badgeBg = '#FF3B30',
        badgeStyle = 'simple',
        accentLine = null,
    } = ts;

    const U = Math.min(W, H) / 18;
    const zoneTop = format === 'story' ? H * .64 : H * .58;
    const marginL = W * .08;
    const maxWidth = W * .84;

    if (accentLine) {
        ctx.fillStyle = accentLine;
        ctx.fillRect(marginL, zoneTop - U * 1.4, U * 3.5, U * .16);
    }

    if (badgeText && badgeStyle === 'decorative') {
        ctx.save();
        const bigSize = U * 3.8;
        const bx = marginL;
        const by = H * .042;
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = U * .6;
        ctx.fillStyle = badgeBg || '#C9A227';
        drawStar(ctx, bx + bigSize * .48, by - U * .5, U * 1.05);
        ctx.font = `900 ${bigSize}px "Arial Black", Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.shadowBlur = U * .9; ctx.shadowOffsetY = U * .2;
        const bGr = ctx.createLinearGradient(bx, by, bx, by + bigSize);
        bGr.addColorStop(0, '#FFF4B0');
        bGr.addColorStop(.35, '#FFD700');
        bGr.addColorStop(.65, badgeBg || '#C9A227');
        bGr.addColorStop(1, '#7A5000');
        ctx.fillStyle = bGr;
        ctx.fillText(badgeText, bx, by);
        ctx.lineWidth = U * .05; ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.strokeText(badgeText, bx, by);
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        const pFont = `bold ${U * .8}px Arial, sans-serif`;
        ctx.font = pFont; ctx.textBaseline = 'middle';
        const pw = ctx.measureText(badgeText).width + U * 1.2;
        const ph = U * 1.45;
        const px2 = bx, py2 = by + bigSize + U * .18;
        roundRectPath(ctx, px2, py2, pw, ph, ph / 2);
        ctx.fillStyle = badgeBg || '#C9A227'; ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(badgeText, px2 + U * .6, py2 + ph / 2);
        ctx.restore();
    } else if (badgeText) {
        ctx.save();
        const badgeFont = `bold ${U * .95}px "Arial Black", Arial, sans-serif`;
        ctx.font = badgeFont;
        const bw = ctx.measureText(badgeText).width + U * 1.2;
        const bh = U * 1.8;
        const bx = marginL, by = zoneTop - U * 4.2;
        roundRectPath(ctx, bx, by, bw, bh, bh / 2);
        ctx.fillStyle = badgeBg || '#FF3B30'; ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, bx + U * .6, by + bh / 2);
        ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.62)';
    ctx.shadowBlur = U * .55;
    ctx.shadowOffsetY = U * .12;

    const headFont = `900 ${U * 1.85}px "Arial Black", Arial, sans-serif`;
    ctx.font = headFont; ctx.textBaseline = 'top';

    if (Array.isArray(headlineGradient) && headlineGradient.length >= 2) {
        const hGr = ctx.createLinearGradient(marginL, zoneTop, marginL, zoneTop + U * 5);
        headlineGradient.forEach((c, i) => hGr.addColorStop(i / (headlineGradient.length - 1), c));
        ctx.fillStyle = hGr;
    } else {
        ctx.fillStyle = headlineColor;
    }
    wrapText(ctx, headline, marginL, zoneTop, maxWidth, U * 2.2);
    const hLines = countLines(ctx, headline, maxWidth, headFont);

    const tagTop = zoneTop + hLines * U * 2.2 + U * .7;
    ctx.font = `${U}px Arial, sans-serif`;
    ctx.fillStyle = taglineColor;
    wrapText(ctx, tagline, marginL, tagTop, maxWidth, U * 1.35);
    ctx.restore();

    if (cta) {
        ctx.save();
        const ctaFont = `bold ${U * .95}px Arial, sans-serif`;
        ctx.font = ctaFont;
        const ctaW = ctx.measureText(cta).width + U * 2.6;
        const ctaH = U * 2.0;
        const ctaX = marginL, ctaY = H - U * 4.5;
        roundRectPath(ctx, ctaX, ctaY, ctaW, ctaH, ctaH / 2);
        if (ctaBg) {
            ctx.fillStyle = ctaBg; ctx.fill(); ctx.fillStyle = ctaColor;
        } else {
            ctx.strokeStyle = ctaColor; ctx.lineWidth = U * .1; ctx.stroke();
            ctx.fillStyle = ctaColor;
        }
        ctx.font = ctaFont; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = U * .3;
        ctx.fillText(cta, ctaX + U * 1.3, ctaY + ctaH / 2);
        ctx.restore();
    }
}

// ─── Decoraciones contextuales ────────────────────────────────────────────────

function drawContextualDecor(ctx, W, H, items, layer) {
    (items || [])
        .filter(d => (d.layer || 'bg') === (layer || 'bg'))
        .forEach(item => {
            const size = Math.min(W, H) * (item.size || .18);
            const cx = W * (item.x ?? item.cx ?? .85);
            const cy = H * (item.y ?? item.cy ?? .1);
            ctx.save();
            ctx.globalAlpha = item.opacity ?? .7;
            switch (item.type) {
                case 'sportsball':
                    drawSoccerBall(ctx, cx, cy, size / 2);
                    break;
                case 'star': {
                    const sGr = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
                    sGr.addColorStop(0, item.color || '#FFE566');
                    sGr.addColorStop(1, item.color2 || '#C9A227');
                    ctx.fillStyle = sGr;
                    drawStar(ctx, cx, cy, size / 2);
                    ctx.fill();
                    break;
                }
                case 'sparkle':
                    drawSparkle(ctx, cx, cy, size, item.color || '#FFD700');
                    break;
                default:
                    break;
            }
            ctx.restore();
        });
}

// ─── Placeholder ──────────────────────────────────────────────────────────────

function drawProductPlaceholder(ctx, W, H, format, offerType) {
    const ps = Math.min(W, H) * (format === 'story' ? .44 : .42);
    const px = (W - ps) / 2, py = H * (format === 'story' ? .16 : .10);
    ctx.save();
    ctx.globalAlpha = .15; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(px + ps / 2, py + ps / 2, ps * .48, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = .45;
    ctx.font = `bold ${ps * .3}px "Arial Black", Arial`;
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = offerType === '2x1' ? '2×1' : offerType === '3x2' ? '3×2' : offerType === 'mitad' ? '½' : offerType === 'descuento' ? '%' : '★';
    ctx.fillText(label, px + ps / 2, py + ps / 2);
    ctx.restore();
}

// ─── Composición ─────────────────────────────────────────────────────────────

async function composeAd({ bgSpec, textSpec, contextualDecor, productImg, format, offerType }) {
    const fmt = FORMATS.find(f => f.id === format) ?? FORMATS[0];
    const W = fmt.w, H = fmt.h;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    drawBackground(ctx, W, H, bgSpec);
    drawContextualDecor(ctx, W, H, contextualDecor, 'bg');

    const overlay = ctx.createLinearGradient(0, H * .40, 0, H);
    overlay.addColorStop(0, 'rgba(0,0,0,0)');
    overlay.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = overlay;
    ctx.fillRect(0, 0, W, H);

    if (productImg) {
        try {
            const img = await loadImage(productImg);
            const noBgCvs = removeBackground(img);
            const ps = Math.min(W, H) * (format === 'story' ? .60 : .54);
            const px = (W - ps) / 2;
            const py = H * (format === 'story' ? .13 : .06);
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.45)';
            ctx.shadowBlur = ps * .09;
            ctx.shadowOffsetY = ps * .04;
            ctx.drawImage(noBgCvs, px, py, ps, ps);
            ctx.restore();
        } catch (_) {
            drawProductPlaceholder(ctx, W, H, format, offerType);
        }
    } else {
        drawProductPlaceholder(ctx, W, H, format, offerType);
    }

    drawText(ctx, W, H, textSpec, format);
    drawContextualDecor(ctx, W, H, contextualDecor, 'front');

    return canvas;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function generateAdImages({ offerName, offerType, title, tagline, cta, productName, format }) {
    const res = await fetch('/api/ai/ad-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerName, offerType, title, tagline, cta, productName, format }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
    }
    const data = await res.json();
    return data.variants;
}

async function fetchCanvasSpecs({ offerName, offerType, title, tagline, cta, productName, format }) {
    const res = await fetch('/api/ai/ad-generate-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerName, offerType, title, tagline, cta, productName, format }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
    }
    const data = await res.json();
    return data.variants;
}

function AdCreatorModalOriginal({ isOpen, onClose, offer, offers = [] }) {
    const [step, setStep] = useState(1);
    const [activeOffer, setActiveOffer] = useState(offer);
    const [title, setTitle] = useState('');
    const [tagline, setTagline] = useState('');
    const [cta, setCta] = useState(CTA_OPTIONS[0]);
    const [format, setFormat] = useState('square');
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');
    const [canvases, setCanvases] = useState([]);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState('');
    const [adMode, setAdMode] = useState(null);

    useEffect(() => {
        if (isOpen) {
            setActiveOffer(offer);
            setStep(1); setGenerating(false); setCanvases([]);
            setError(''); setSelected(null); setAdMode(null); setTitle(''); setTagline('');
            setCta(CTA_OPTIONS[0]); setFormat('square'); setProgress(0);
        }
    }, [isOpen, offer]);

    const productImg = activeOffer?.products?.[0]?.images?.[0]?.url
        ?? activeOffer?.products?.[0]?.image_url
        ?? null;
    const productName = activeOffer?.products?.[0]?.name ?? activeOffer?.name ?? '';

    const handleGenerate = useCallback(async () => {
        setGenerating(true); setError(''); setCanvases([]); setSelected(null);
        setProgress(0); setStep(3); setAdMode(null);

        const params = {
            offerName: activeOffer?.name ?? 'Promoción',
            offerType: activeOffer?.type ?? '',
            title, tagline, cta, productName, format,
        };

        try {
            setProgressMsg('Generando imágenes con IA…');
            setProgress(10);

            const variants = await generateAdImages(params);

            if (variants?.length > 0) {
                setProgress(95);
                setProgressMsg('¡Imágenes listas!');

                const images = variants.map(v => {
                    const img = new Image();
                    img.src = `data:${v.mimeType};base64,${v.imageBase64}`;
                    return { img, style: v.style, base64: v.imageBase64, mimeType: v.mimeType };
                });

                setProgress(100);
                setCanvases(images);
                setSelected(0);
                setAdMode('ai');
                setGenerating(false);
                return;
            }
        } catch (aiErr) {
            console.warn('[AdCreator] IA no disponible, intentando Canvas:', aiErr.message);
        }

        try {
            setProgress(15);
            setProgressMsg('Diseñando con Canvas local…');

            const specs = await fetchCanvasSpecs(params);
            setProgress(40);

            const results = [];
            for (let i = 0; i < specs.length; i++) {
                setProgressMsg(`Componiendo diseño ${i + 1} de ${specs.length}…`);

                const canvas = await composeAd({
                    bgSpec: specs[i].bgSpec,
                    textSpec: specs[i].textSpec,
                    contextualDecor: specs[i].contextualDecor || [],
                    productImg,
                    format,
                    offerType: activeOffer?.type,
                });

                const dataUrl = canvas.toDataURL('image/png');
                const base64 = dataUrl.split(',')[1];
                results.push({ style: specs[i].style, base64, mimeType: 'image/png' });
                setProgress(40 + Math.round(((i + 1) / specs.length) * 55));
            }

            setProgressMsg('¡Diseños listos!');
            setProgress(100);
            setCanvases(results);
            setSelected(0);
            setAdMode('canvas');
        } catch (fallbackErr) {
            setError('No se pudieron generar los anuncios. ' + (fallbackErr.message || 'Intenta de nuevo.'));
        }

        setGenerating(false);
    }, [activeOffer, title, tagline, cta, productName, format, productImg]);

    const handleDownload = useCallback((idx) => {
        const item = canvases[idx];
        if (!item) return;
        const fmt = FORMATS.find(f => f.id === format);
        const a = document.createElement('a');
        a.href = `data:${item.mimeType};base64,${item.base64}`;
        a.download = `anuncio-${item.style}-${fmt?.id ?? 'img'}.png`;
        a.click();
    }, [canvases, format]);

    if (!isOpen) return null;

    const stepSubtitle = step === 1 ? 'Personaliza el mensaje'
        : step === 2 ? 'Elige el formato'
            : generating ? 'Generando diseños…'
                : 'Elige tu favorito';

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ width: '100%', maxWidth: '560px', minWidth: '320px', maxHeight: '92vh' }}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                    <div>
                        <h2 className="text-[17px] font-bold text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                auto_awesome
                            </span>
                            Crear Publicidad con IA
                        </h2>
                        <p className="text-[12px] text-gray-500 mt-0.5">{stepSubtitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
                        aria-label="Cerrar"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="flex items-center px-6 py-3 gap-2 border-b border-gray-200 shrink-0">
                    {[1, 2, 3].map((s, idx) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${s < step ? 'bg-purple-600 text-white'
                                    : s === step ? 'border-2 border-purple-600 bg-purple-50 text-purple-600'
                                        : 'bg-gray-100 text-gray-400'
                                }`}>
                                {s < step
                                    ? <span className="material-symbols-outlined text-[13px]">check</span>
                                    : s}
                            </div>
                            <span className={`text-[11px] hidden sm:inline ${s === step ? 'text-purple-600 font-semibold' : 'text-gray-500'}`}>
                                {s === 1 ? 'Mensaje' : s === 2 ? 'Formato' : 'Generar'}
                            </span>
                            {idx < 2 && <span className="text-gray-300 text-[14px] mx-1">›</span>}
                        </div>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <FieldLabel required>Oferta base</FieldLabel>
                                <select
                                    value={activeOffer?.id ?? ''}
                                    onChange={e => setActiveOffer(offers.find(o => String(o.id) === e.target.value) ?? null)}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all"
                                >
                                    <option value="">— Selecciona una oferta —</option>
                                    {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            </div>

                            {activeOffer && (
                                <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                                    {productImg
                                        ? <img src={productImg} alt={productName} className="w-10 h-10 rounded-lg object-cover border border-purple-200" />
                                        : <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-purple-500 text-[20px]">package_2</span>
                                        </div>
                                    }
                                    <div>
                                        <p className="text-[12px] font-semibold text-purple-800">{productName}</p>
                                        <p className="text-[11px] text-purple-500">
                                            {productImg ? 'Imagen detectada — se eliminará el fondo ✓' : 'Sin imagen — se usará icono de la oferta'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div>
                                <FieldLabel>Titular del anuncio</FieldLabel>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder={activeOffer ? `Ej. ¡${activeOffer.name}!` : 'Ej. ¡2×1 en Refrescos!'}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Déjalo vacío para que la IA lo genere automáticamente</p>
                            </div>

                            <div>
                                <FieldLabel>
                                    Descripción
                                    <span className="ml-1 text-gray-400 normal-case font-normal">(máx. 100 car.)</span>
                                </FieldLabel>
                                <textarea
                                    value={tagline}
                                    onChange={e => setTagline(e.target.value.slice(0, 100))}
                                    placeholder="Ej. Lleva 2 y paga solo 1. ¡Por tiempo limitado!"
                                    rows={2}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-600 transition-all resize-none"
                                />
                                <p className="text-right text-[10px] text-gray-400 mt-0.5">{tagline.length}/100</p>
                            </div>

                            <div>
                                <FieldLabel>Llamada a la acción</FieldLabel>
                                <div className="flex flex-wrap gap-2">
                                    {CTA_OPTIONS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setCta(c)}
                                            className={`px-3 py-1 rounded-full text-[12px] border transition-all ${cta === c ? 'bg-purple-50 border-purple-600 text-purple-600 font-medium'
                                                    : 'border-gray-300 text-gray-600 hover:border-purple-400 hover:bg-purple-50/30'
                                                }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-3">
                            <p className="text-[13px] text-gray-500">
                                Elige el formato. La IA creará <strong>3 estilos visuales</strong> distintos, cada uno con tema y paleta únicos.
                            </p>

                            {FORMATS.map(f => {
                                const active = format === f.id;
                                return (
                                    <button
                                        key={f.id}
                                        onClick={() => setFormat(f.id)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${active ? 'border-purple-600 bg-purple-50/50 shadow-sm'
                                                : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50/10'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-bold text-[14px] ${active ? 'text-purple-600' : 'text-gray-900'}`}>{f.label}</p>
                                            <p className="text-[12px] text-gray-500">{f.desc} · {f.ratio} · {f.w}×{f.h}px</p>
                                        </div>
                                        {active && (
                                            <span className="material-symbols-outlined text-purple-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                check_circle
                                            </span>
                                        )}
                                    </button>
                                );
                            })}

                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-3">Se generarán 3 estilos con IA</p>
                                <div className="grid grid-cols-3 gap-3">
                                    {STYLE_VARIANTS.map(sv => (
                                        <div key={sv.id} className="text-center">
                                            <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center mb-1.5">
                                                <span className="material-symbols-outlined text-gray-400 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                    auto_awesome
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-semibold text-gray-700">{sv.label}</p>
                                            <p className="text-[9px] text-gray-400 leading-tight">{sv.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && generating && (
                        <div className="flex flex-col items-center gap-5 py-8">
                            <div className="relative w-[60px] h-[60px]">
                                <div className="absolute inset-0 rounded-full border-[3px] border-purple-100" />
                                <div
                                    className="absolute inset-0 rounded-full border-[3px] border-purple-600 border-t-transparent"
                                    style={{ animation: 'adSpinKf 1s linear infinite' }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-purple-600 text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        auto_awesome
                                    </span>
                                </div>
                            </div>

                            <div className="w-full space-y-1.5">
                                <div className="flex justify-between text-[12px] text-gray-500">
                                    <span>{progressMsg}</span>
                                    <span className="font-bold text-purple-600">{progress}%</span>
                                </div>
                                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7F77DD,#534AB7)' }}
                                    />
                                </div>
                            </div>

                            <div className="text-center">
                                <p className="font-bold text-[15px] text-gray-900">Diseñando tus anuncios…</p>
                                <p className="text-[12px] text-gray-400 mt-1">
                                    La IA detecta el tema, genera fondos atmosféricos,<br />
                                    elimina el fondo del producto y compone 3 variaciones
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-3 w-full">
                                {STYLE_VARIANTS.map((sv, i) => (
                                    <div key={sv.id} className="space-y-1">
                                        <div
                                            className="aspect-square rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse"
                                            style={{ animationDelay: `${i * .22}s` }}
                                        />
                                        <p className="text-[9px] text-center text-gray-400">{sv.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 3 && !generating && canvases.length > 0 && (
                        <div className="space-y-4">
                            {error && (
                                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-[12px] text-red-600">
                                    <span className="material-symbols-outlined text-[16px]">error</span>
                                    {error}
                                </div>
                            )}
                            <p className="text-[13px] text-gray-500">
                                ¡Listos! Toca una variante para seleccionarla y descargarla en alta resolución.
                            </p>
                            {adMode && (
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium ${
                                    adMode === 'ai'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                        {adMode === 'ai' ? 'auto_awesome' : 'palette'}
                                    </span>
                                    {adMode === 'ai' ? 'Generado con IA' : 'Generado con Canvas local'}
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-3">
                                {canvases.map((canvas, i) => (
                                    <CanvasCard
                                        key={i}
                                        canvas={canvas}
                                        label={STYLE_VARIANTS[i].label}
                                        isSelected={selected === i}
                                        onSelect={() => setSelected(i)}
                                        onDownload={e => { e.stopPropagation(); handleDownload(i); }}
                                    />
                                ))}
                            </div>

                            {selected !== null && (
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={() => handleDownload(selected)}
                                        className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-purple-700 transition-all active:scale-95"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">download</span>
                                        Descargar {STYLE_VARIANTS[selected].label}
                                    </button>
                                    <button
                                        onClick={() => canvases.forEach((_, i) => handleDownload(i))}
                                        className="px-3 py-2.5 border border-gray-300 text-gray-600 rounded-xl text-[13px] hover:bg-gray-50 transition-colors"
                                        title="Descargar las 3 variantes"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">download_for_offline</span>
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => { setCanvases([]); setSelected(null); setError(''); handleGenerate(); }}
                                className="w-full py-2 border border-gray-300 rounded-xl text-[13px] text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                Regenerar diseños
                            </button>
                        </div>
                    )}

                    {step === 3 && !generating && error && canvases.length === 0 && (
                        <div className="flex flex-col items-center gap-4 py-10 text-center">
                            <span className="material-symbols-outlined text-red-400 text-[48px]">error_outline</span>
                            <div>
                                <p className="font-bold text-gray-800">Algo salió mal</p>
                                <p className="text-[12px] text-gray-500 mt-1">{error}</p>
                            </div>
                            <button
                                onClick={() => { setError(''); handleGenerate(); }}
                                className="px-5 py-2 bg-purple-600 text-white rounded-xl text-[13px] font-bold hover:bg-purple-700 transition-all"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex items-center justify-between gap-3">
                    <button
                        onClick={() => {
                            if (generating) return;
                            if (step > 1) { setStep(s => s - 1); setCanvases([]); setSelected(null); setError(''); }
                            else onClose();
                        }}
                        disabled={generating}
                        className="px-4 py-2 border border-gray-300 text-gray-600 rounded-xl text-[13px] font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
                    >
                        {step === 1 ? 'Cancelar' : generating ? 'Generando…' : 'Atrás'}
                    </button>

                    {step === 1 && (
                        <button
                            onClick={() => setStep(2)}
                            disabled={!activeOffer}
                            className="px-5 py-2 bg-purple-600 text-white rounded-xl text-[13px] font-bold flex items-center gap-1 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Siguiente
                            <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                        </button>
                    )}

                    {step === 2 && (
                        <button
                            onClick={handleGenerate}
                            className="px-5 py-2 bg-purple-600 text-white rounded-xl text-[13px] font-bold flex items-center gap-1 hover:bg-purple-700 transition-all active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                            Generar con IA
                        </button>
                    )}

                    {step === 3 && !generating && canvases.length > 0 && (
                        <button
                            onClick={onClose}
                            className="px-5 py-2 bg-purple-600 text-white rounded-xl text-[13px] font-bold hover:bg-purple-700 transition-all active:scale-95"
                        >
                            Listo
                        </button>
                    )}
                </div>
            </div>

            <style>{`@keyframes adSpinKf { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

function CanvasCard({ canvas: item, label, isSelected, onSelect, onDownload }) {
  return (
    <div
      onClick={onSelect}
      className={`group relative cursor-pointer rounded-xl overflow-hidden transition-all ${
        isSelected ? 'ring-[2.5px] ring-purple-600 shadow-lg scale-[1.02]'
                   : 'hover:shadow-md hover:scale-[1.01]'
      }`}
    >
      <img
        src={`data:${item.mimeType};base64,${item.base64}`}
        alt={label}
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />

      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center">
        <button
          onClick={onDownload}
          className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors shadow-md"
          title="Descargar"
        >
          <span className="material-symbols-outlined text-[17px] text-gray-800">download</span>
        </button>
      </div>

      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-1.5 pointer-events-none">
        <p className="text-white text-[9px] font-bold">{label}</p>
      </div>

      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-[12px]">check</span>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children, required }) {
    return (
        <label className="font-semibold text-gray-700 uppercase tracking-wide text-[10px] mb-1 block">
            {children}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
    );
}

═══════════════════════════════════════════════════════════════════════════ */