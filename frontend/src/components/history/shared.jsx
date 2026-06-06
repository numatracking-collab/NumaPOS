/* ═══════════════════════════════════════════════════════════════════════════
   _shared.jsx — Micro-componentes reutilizables del módulo Historial
═══════════════════════════════════════════════════════════════════════════ */

export function Row({ label, value, mono = false }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-on-surface-variant">{label}</span>
            <span className={`text-[12px] font-medium text-on-surface ${mono ? 'font-mono' : ''}`}>
                {value}
            </span>
        </div>
    );
}

export function LoadingState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-[40px] animate-spin">refresh</span>
            <span className="text-[13px] font-medium">Cargando...</span>
        </div>
    );
}

export function EmptyState({ label }) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] text-outline-variant">search_off</span>
            <span className="text-[13px] font-medium">{label}</span>
        </div>
    );
}

/* ── Badge de estado de impresión — igual al de CheckoutModal ─────────── */
export function PrintStatusBadge({ status, error }) {
    if (status === 'idle' || status === 'skipped') return null;

    const configs = {
        printing: {
            icon: 'autorenew',
            spin: true,
            text: 'Enviando a la impresora…',
            cls:  'bg-blue-50 border-blue-200 text-blue-700',
        },
        ok: {
            icon: 'print',
            spin: false,
            text: 'Ticket impreso correctamente',
            cls:  'bg-emerald-50 border-emerald-200 text-emerald-700',
        },
        error: {
            icon: 'print_disabled',
            spin: false,
            text: `Error al imprimir${error ? `: ${error}` : ''}`,
            cls:  'bg-red-50 border-red-200 text-red-700',
        },
    };

    const c = configs[status];
    if (!c) return null;

    return (
        <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${c.cls}`}>
            <span className={`material-symbols-outlined text-[18px] shrink-0 mt-px ${c.spin ? 'animate-spin' : ''}`}>
                {c.icon}
            </span>
            <span className="text-left leading-snug">{c.text}</span>
        </div>
    );
}