const VITE_API_URL = 'http://localhost:3002/api';

async function request(endpoint, options = {}) {
    const token = sessionStorage.getItem('numa_token');
    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
            ...options.headers,
        },
        ...options,
    };
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Error en la solicitud al servidor.');
    return data;
}

const post = (url, body) => request(url, { method: 'POST', body: JSON.stringify(body) });
const put  = (url, body) => request(url, { method: 'PUT',  body: JSON.stringify(body) });
const del  = (url)       => request(url, { method: 'DELETE' });

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authService = {
    register: (data) => post('/auth/register', data),
    login:    (data) => post('/auth/login', data),
 
    // Devuelve el perfil del usuario autenticado.
    // El backend debe tener GET /auth/me protegido con el token JWT.
    getUser: () => request('/auth/me'),
};
 

// ── Categorías ────────────────────────────────────────────────────────────────
export const categoryService = {
    getAll: ()         => request('/categories'),
    create: (data)     => post('/categories', data),
    update: (id, data) => put(`/categories/${id}`, data),
    delete: (id)       => del(`/categories/${id}`),
};

// ── Productos ─────────────────────────────────────────────────────────────────
export const productService = {
    getAll: ()         => request('/products'),
    create: (data)     => post('/products', data),
    update: (id, data) => put(`/products/${id}`, data),
    delete: (id)       => del(`/products/${id}`),
};

// ── Inventario ────────────────────────────────────────────────────────────────
export const inventoryService = {
    getAdjustments: (productId) => request(`/inventory/adjustments/${productId}`),
    adjust:         (data)      => post('/inventory/adjust', data),
};

// ── Ventas ────────────────────────────────────────────────────────────────────
export const salesService = {
    // body: { items[], payment_method, amount_paid, caja_id }
    create: (data)        => post('/sales', data),
    list:   (params = {}) => request(`/sales?${new URLSearchParams(params)}`),
    get:    (id)          => request(`/sales/${id}`),
};

// ── Cajas físicas y Cortes ────────────────────────────────────────────────────
export const cajasService = {
    // Cajas físicas
    getAll: ()     => request('/cash-registers/cajas'),
    create: (data) => post('/cash-registers/cajas', data),

    // Corte  — body: { caja_id, notes? }
    corte:     (data)          => post('/cash-registers/corte', data),

    // Historial de cortes  — opcional: { caja_id }
    getCortes: (params = {})   => request(`/cash-registers/cortes?${new URLSearchParams(params)}`),

    // Preview del próximo corte sin guardarlo
    preview:   (caja_id)       => request(`/cash-registers/preview?caja_id=${caja_id}`),
};

// ── Series de folios ──────────────────────────────────────────────────────────
export const invoiceSeriesService = {
    // Lista todas las series del tenant
    getAll: () => request('/invoice-series'),

    // Crear nueva serie  — body: { name, prefix, next_folio? }
    create: (data) => post('/invoice-series', data),

    // Marcar como serie por defecto (el backend siempre usa la default al vender)
    setDefault: (id) => post(`/invoice-series/${id}/default`, {}),
};

export default request;