/* ═══════════════════════════════════════════════════════════════════════════
   api.js — Servicios de la API de NUMA POS
═══════════════════════════════════════════════════════════════════════════ */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

/* ── Helpers ─────────────────────────────────────────────────────────── */
function getToken() {
    return sessionStorage.getItem('numa_token');
}

function authHeaders() {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
    };
}

function toQS(params = {}) {
    const clean = Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );
    return new URLSearchParams(clean).toString();
}

async function request(method, path, body) {
    const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: authHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || `Error ${res.status}`);
    }
    return res.json();
}

/* ── Autenticación ───────────────────────────────────────────────────── */
export const authService = {
    login:   (body) => request('POST', '/auth/login', body),
    logout:  ()     => request('POST', '/auth/logout'),
    getUser: ()     => request('GET',  '/auth/me'),
};

/* ── Ventas ──────────────────────────────────────────────────────────── */
export const salesService = {
    list:   (params)         => request('GET',  `/sales?${toQS(params)}`),
    get:    (id)             => request('GET',  `/sales/${id}`),
    create: (body)           => request('POST', '/sales', body),
    cancel: (id, reason = '') => request('POST', `/sales/${id}/cancel`, { reason }),
};

/* ── Inventario / Productos ──────────────────────────────────────────── */
export const inventoryService = {
    getAll:            (params)     => request('GET',    `/products?${toQS(params)}`),
    get:               (id)         => request('GET',    `/products/${id}`),
    create:            (body)       => request('POST',   '/products', body),
    update:            (id, b)      => request('PUT',    `/products/${id}`, b),
    delete:            (id)         => request('DELETE', `/products/${id}`),
    getAllAdjustments:  (params)     => request('GET',    `/inventory/adjustments?${toQS(params)}`),
    getProductHistory: (productId)  => request('GET',    `/inventory/adjustments/${productId}`),
    createAdjustment:  (body)       => request('POST',   '/inventory/adjust', body),
};

/* ── Cajas ───────────────────────────────────────────────────────────── */
export const cajasService = {
    // Cajas físicas
    getAll:  ()      => request('GET',    '/cash-registers/cajas'),
    get:     (id)    => request('GET',    `/cash-registers/cajas/${id}`),
    create:  (body)  => request('POST',   '/cash-registers/cajas', body),
    update:  (id, b) => request('PUT',    `/cash-registers/cajas/${id}`, b),
    delete:  (id)    => request('DELETE', `/cash-registers/cajas/${id}`),

    // Movimientos de caja (entradas y salidas manuales)
    createMovement: (body)    => request('POST', '/cash-registers/movements', body),
    getMovements:   (cajaId)  => request('GET',  `/cash-registers/movements?caja_id=${cajaId}`),

    // Cortes
    createCorte: (body)    => request('POST', '/cash-registers/corte', body),
    getCortes:   ()        => request('GET',  '/cash-registers/cortes'),
    getPreview:  (cajaId)  => request('GET',  `/cash-registers/preview?caja_id=${cajaId}`),
};

/* ── Series de facturación ───────────────────────────────────────────── */
export const seriesService = {
    getAll:     ()      => request('GET',    '/invoice-series'),
    get:        (id)    => request('GET',    `/invoice-series/${id}`),
    create:     (body)  => request('POST',   '/invoice-series', body),
    update:     (id, b) => request('PUT',    `/invoice-series/${id}`, b),
    delete:     (id)    => request('DELETE', `/invoice-series/${id}`),
    setDefault: (id)    => request('POST',   `/invoice-series/${id}/default`),
};

export const invoiceSeriesService = seriesService;

/* ── Categorías ──────────────────────────────────────────────────────── */
export const categoryService = {
    getAll: (params) => request('GET',    `/categories?${toQS(params)}`),
    get:    (id)     => request('GET',    `/categories/${id}`),
    create: (body)   => request('POST',   '/categories', body),
    update: (id, b)  => request('PUT',    `/categories/${id}`, b),
    delete: (id)     => request('DELETE', `/categories/${id}`),
};

/* ── Ofertas de marketing ────────────────────────────────────────────── */
export const offersService = {
    getAll:    (params)     => request('GET',    `/offers?${toQS(params)}`),
    get:       (id)         => request('GET',    `/offers/${id}`),
    create:    (body)       => request('POST',   '/offers', body),
    update:    (id, body)   => request('PUT',    `/offers/${id}`, body),
    setStatus: (id, status) => request('PATCH',  `/offers/${id}/status`, { status }),
    delete:    (id)         => request('DELETE', `/offers/${id}`),
};