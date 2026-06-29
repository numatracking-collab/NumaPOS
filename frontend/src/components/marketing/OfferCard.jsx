import { useState, useRef, useEffect } from 'react';

const STATUS_CONFIG = {
    active:    { label: 'Activa',      bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
    scheduled: { label: 'Programada',  bg: 'bg-blue-50',    text: 'text-blue-600',   dot: 'bg-blue-500'   },
    expired:   { label: 'Vencida',     bg: 'bg-slate-100',  text: 'text-slate-500',  dot: 'bg-slate-400'  },
    draft:     { label: 'Borrador',    bg: 'bg-orange-50',  text: 'text-orange-600', dot: 'bg-orange-400' },
};

const TYPE_META = {
    '2x1':       { icon: 'content_copy', label: '2 × 1'     },
    '3x2':       { icon: 'redeem',       label: '3 × 2'     },
    'nxm':       { icon: 'swap_horiz',   label: 'Combo'     },
    'mitad':     { icon: 'percent',      label: '½ Precio'  },
    'descuento': { icon: 'sell',         label: 'Descuento' },
};

const DAYS_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y.slice(2)}`;
}

export default function OfferCard({ offer, onEdit, onDelete, onToggleStatus, onCreateAd }) {
    const status   = STATUS_CONFIG[offer.status] ?? STATUS_CONFIG.draft;
    const typeMeta = TYPE_META[offer.type]       ?? { icon: 'local_offer', label: offer.type };

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Cerrar el dropdown al tocar fuera
    useEffect(() => {
        if (!menuOpen) return;
        function handleOutside(e) {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('touchstart', handleOutside);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('touchstart', handleOutside);
        };
    }, [menuOpen]);

    const isActive = offer.status === 'active';

    return (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden hover:shadow-md transition-all group">

            {/* ── Cabecera ─────────────────────────────────────────────────── */}
            <div className="flex items-start gap-md p-md border-b border-outline-variant/50">

                {/* Icono de tipo */}
                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[20px] text-secondary">{typeMeta.icon}</span>
                </div>

                {/* Nombre + badges */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm mb-xs flex-wrap">
                        <h3 className="font-bold text-[14px] text-on-surface leading-tight">{offer.name}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${status.bg} ${status.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-xs flex-wrap">
                        <span className="text-[11px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-medium">
                            {typeMeta.label}
                        </span>
                        {(offer.products ?? []).map(p => (
                            <span key={p.id} className="text-[11px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full border border-outline-variant/30 max-w-[160px] truncate">
                                {p.name}
                            </span>
                        ))}
                    </div>
                </div>

                {/* ── Acciones DESKTOP: aparecen con hover ─────────────────── */}
                <div className="hidden md:flex gap-xs shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onToggleStatus && (
                        <button
                            onClick={onToggleStatus}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-colors"
                            title={isActive ? 'Desactivar' : 'Activar'}
                        >
                            <span className="material-symbols-outlined text-[17px]">
                                {isActive ? 'pause_circle' : 'play_circle'}
                            </span>
                        </button>
                    )}
                    <button
                        onClick={onEdit}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-secondary hover:bg-secondary/10 transition-colors"
                        title="Editar"
                    >
                        <span className="material-symbols-outlined text-[17px]">edit</span>
                    </button>
                    <button
                        onClick={onDelete}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                        title="Eliminar"
                    >
                        <span className="material-symbols-outlined text-[17px]">delete</span>
                    </button>
                </div>

                {/* ── Acción MÓVIL: botón de 3 puntos con dropdown ─────────── */}
                <div className="md:hidden relative shrink-0" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen(v => !v)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors"
                        aria-label="Más opciones"
                    >
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                    </button>

                    {/* Dropdown */}
                    {menuOpen && (
                        <div className="absolute right-0 top-9 z-50 min-w-[160px] bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg overflow-hidden">

                            {/* Activar / Desactivar */}
                            {onToggleStatus && (
                                <button
                                    onClick={() => { onToggleStatus(); setMenuOpen(false); }}
                                    className="w-full flex items-center gap-sm px-md py-sm text-[13px] text-on-surface hover:bg-surface-container transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[17px] text-on-surface-variant">
                                        {isActive ? 'pause_circle' : 'play_circle'}
                                    </span>
                                    {isActive ? 'Desactivar' : 'Activar'}
                                </button>
                            )}

                            {/* Editar */}
                            <button
                                onClick={() => { onEdit(); setMenuOpen(false); }}
                                className="w-full flex items-center gap-sm px-md py-sm text-[13px] text-on-surface hover:bg-surface-container transition-colors"
                            >
                                <span className="material-symbols-outlined text-[17px] text-on-surface-variant">edit</span>
                                Editar
                            </button>

                            {/* Separador */}
                            <div className="h-px bg-outline-variant/40 mx-md" />

                            {/* Eliminar */}
                            <button
                                onClick={() => { onDelete(); setMenuOpen(false); }}
                                className="w-full flex items-center gap-sm px-md py-sm text-[13px] text-error hover:bg-error/10 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[17px]">delete</span>
                                Eliminar
                            </button>
                        </div>
                    )}
                </div>

            </div>

            {/* ── Pie: días, horario, fechas y botón de publicidad ─────────── */}
            <div className="px-md py-sm flex items-center justify-between gap-md flex-wrap">
                <div className="flex items-center gap-md text-[11px] text-on-surface-variant flex-wrap">

                    {/* Días */}
                    <div className="flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        <div className="flex gap-0.5">
                            {DAYS_LABELS.map((d, i) => (
                                <span
                                    key={i}
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                        (offer.days ?? offer.active_days ?? []).includes(i)
                                            ? 'bg-secondary/20 text-secondary'
                                            : 'text-on-surface-variant/30'
                                    }`}
                                >
                                    {d[0]}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Horario */}
                    <div className="flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                        <span className="font-mono">{offer.timeStart ?? offer.time_start}–{offer.timeEnd ?? offer.time_end}</span>
                    </div>

                    {/* Fechas (solo desktop) */}
                    {(offer.dateStart ?? offer.date_start) && (
                        <div className="hidden md:flex items-center gap-xs">
                            <span className="material-symbols-outlined text-[14px]">date_range</span>
                            <span>
                                {formatDate(offer.dateStart ?? offer.date_start)} → {formatDate(offer.dateEnd ?? offer.date_end)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Botón Crear Publicidad */}
                <button
                    onClick={onCreateAd}
                    className="flex items-center gap-xs px-sm py-xs bg-on-tertiary-container text-tertiary-fixed text-[12px] font-medium rounded-lg hover:opacity-90 transition-all active:scale-95 shrink-0"
                >
                    <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    Crear Publicidad
                </button>
            </div>

        </div>
    );
}