/* ═══════════════════════════════════════════════════════════════════════════
   businessService.js — Datos del negocio + formato de ticket
   ───────────────────────────────────────────────────────────────────────────
   Sigue el mismo patrón que api.js (fetch + Bearer token desde sessionStorage),
   pero uploadLogo() no puede usar el helper `request()` de api.js porque ese
   fuerza Content-Type: application/json y JSON.stringify(body) — rompe
   FormData. Aquí se hace un fetch aparte, dejando que el navegador ponga el
   Content-Type: multipart/form-data con su boundary automáticamente.
   ═══════════════════════════════════════════════════════════════════════════ */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

function getToken() {
    return sessionStorage.getItem('numa_token');
}

let _cache = null;

/* ── GET /api/business ──────────────────────────────────────────────── */
export async function getBusinessSettings(force = false) {
    if (_cache && !force) return _cache;

    const res = await fetch(`${API_URL}/business`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
    }
    const data = await res.json();
    _cache = data;
    return data;
}

/* ── PUT /api/business ──────────────────────────────────────────────── */
export async function saveBusinessSettings(payload) {
    const res = await fetch(`${API_URL}/business`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify(payload),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
    }
    const data = await res.json();
    _cache = data;
    return data;
}

/* ── Solo el ticket_config (usado por los toggles de DevicesPanel) ──── */
export async function saveTicketConfig(ticket_config) {
    return saveBusinessSettings({ ticket_config });
}

/* ── Sube el logo a Cloudinary vía /api/upload (campo "images") ─────── */
export async function uploadLogo(file) {
    const formData = new FormData();
    formData.append('images', file);

    const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${getToken()}`,
            // Sin Content-Type: el navegador lo arma solo con el boundary
        },
        body: formData,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
    }
    const data = await res.json();
    return data.urls[0];
}