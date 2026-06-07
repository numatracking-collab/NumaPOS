/* ═══════════════════════════════════════════════════════════════════════════
   api.js — Servicios de la API de NUMA POS
   Un único export por servicio, sin duplicados.
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

/** Convierte un objeto de parámetros a query string, omitiendo valores vacíos */
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
        throw new Error(err.message || `Error ${res.status}`);
    }
    return res.json();
}

/* ── Autenticación ───────────────────────────────────────────────────── */
export const authService = {
    login:    (body) => request('POST', '/auth/login', body),
    logout:   ()     => request('POST', '/auth/logout'),
    getUser:  ()     => request('GET',  '/auth/me'),
};

/* ── Ventas ──────────────────────────────────────────────────────────── */
export const salesService = {
    list:   (params)        => request('GET',  `/sales?${toQS(params)}`),
    get:    (id)            => request('GET',  `/sales/${id}`),
    create: (body)          => request('POST', '/sales', body),
    cancel: (id, reason='') => request('POST', `/sales/${id}/cancel`, { reason }),
};
 
/* ── Inventario / Productos ──────────────────────────────────────────── */
/* ── Inventario / Productos ──────────────────────────────────────────── */
export const inventoryService = {
    getAll:            (params) => request('GET',    `/products?${toQS(params)}`),
    get:               (id)     => request('GET',    `/products/${id}`),
    create:            (body)   => request('POST',   '/products', body),
    update:            (id, b)  => request('PUT',    `/products/${id}`, b),
    delete:            (id)     => request('DELETE', `/products/${id}`),
    
    // Corregidos para apuntar a los endpoints de tu router de inventario
    getAllAdjustments: (params) => request('GET',    `/inventory/adjustments?${toQS(params)}`),
    getProductHistory: (productId) => request('GET', `/inventory/adjustments/${productId}`),
    createAdjustment:  (body)   => request('POST',   '/inventory/adjust', body), // <-- apunta a /inventory/adjust
};
/* ── Cajas ───────────────────────────────────────────────────────────── */
/* ── Cajas ───────────────────────────────────────────────────────────── */
export const cajasService = {
    // 💡 Añadimos '/cajas' al final para que coincida con el router de Express
    getAll:     ()      => request('GET',    '/cash-registers/cajas'),
    get:        (id)    => request('GET',    `/cash-registers/cajas/${id}`),
    create:     (body)  => request('POST',   '/cash-registers/cajas', body),
    update:     (id, b) => request('PUT',    `/cash-registers/cajas/${id}`, b),
    delete:     (id)    => request('DELETE', `/cash-registers/cajas/${id}`),
    
    // 💡 Estos ya apuntan correctamente a /corte y /cortes según tu backend
    createCorte: (body) => request('POST',   '/cash-registers/corte', body),
    getCortes:   ()      => request('GET',    '/cash-registers/cortes'),
    getPreview:  (cajaId)=> request('GET',    `/cash-registers/preview?caja_id=${cajaId}`),
};

/* ── Series de facturación ───────────────────────────────────────────── */
export const seriesService = {
    // 💡 Cambiado de '/series' a '/invoice-series'
    getAll:     ()      => request('GET',    '/invoice-series'),
    get:        (id)    => request('GET',    `/invoice-series/${id}`),
    create:     (body)  => request('POST',   '/invoice-series', body),
    update:     (id, b) => request('PUT',    `/invoice-series/${id}`, b),
    delete:     (id)    => request('DELETE', `/invoice-series/${id}`),
    // Recuerda agregar el setDefault si tu TopAppBar lo usa:
    setDefault: (id)    => request('PATCH',  `/invoice-series/${id}/set-default`), 
};

// Mantener el alias por si tus componentes lo buscan con el nombre largo
export const invoiceSeriesService = seriesService;

/* ── Categorías ──────────────────────────────────────────────────────── */
export const categoryService = {
    getAll: (params) => request('GET',    `/categories?${toQS(params)}`),
    get:    (id)     => request('GET',    `/categories/${id}`),
    create: (body)   => request('POST',   '/categories', body),
    update: (id, b)  => request('PUT',    `/categories/${id}`, b),
    delete: (id)     => request('DELETE', `/categories/${id}`),
};