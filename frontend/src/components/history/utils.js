/* ═══════════════════════════════════════════════════════════════════════════
   _utils.js — Helpers compartidos del módulo Historial
═══════════════════════════════════════════════════════════════════════════ */

export function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
    });
}

export function fmtTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('es-MX', {
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

export function fmtMoney(n) {
    return `$${Number(n || 0).toFixed(2)}`;
}

export const METHOD_LABEL = {
    cash:     'Efectivo',
    card:     'Tarjeta',
    transfer: 'Transferencia',
};

export const METHOD_COLOR = {
    cash:     'bg-emerald-100 text-emerald-700',
    card:     'bg-blue-100 text-blue-700',
    transfer: 'bg-purple-100 text-purple-700',
};

export function buildDateRange(filter) {
    const now   = new Date();
    const start = new Date();
    switch (filter) {
        case 'today':
            start.setHours(0, 0, 0, 0);
            return { from: start.toISOString(), to: now.toISOString() };
        case 'week':
            start.setDate(now.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            return { from: start.toISOString(), to: now.toISOString() };
        case 'month':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            return { from: start.toISOString(), to: now.toISOString() };
        default:
            return {};
    }
}