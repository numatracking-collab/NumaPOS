/* ═══════════════════════════════════════════════════════════════════════════
   MyOffersPanel.jsx — Panel de listado y gestión de ofertas
   • Sin datos mock — conectado a offersService
   • Pausa / reactiva / elimina desde la tarjeta
   • Filtros por estado con contadores reales
═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import { offersService } from '../../services/api';
import OfferCard        from './OfferCard';
import AdCreatorModal   from './AdCreatorModal';

const FILTERS = [
    { id: 'all',       label: 'Todas'       },
    { id: 'active',    label: 'Activas'     },
    { id: 'paused',    label: 'Pausadas'    },
    { id: 'expired',   label: 'Vencidas'    },
];

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_HEADERS = ['D','L','M','X','J','V','S'];
const DAYS_SHORT  = ['D','L','M','X','J','V','S'];

export default function MyOffersPanel({ onCreateOffer, onEditOffer }) {
    const [offers,        setOffers]        = useState([]);
    const [loading,       setLoading]       = useState(true);
    const [error,         setError]         = useState('');
    const [filter,        setFilter]        = useState('all');
    const [adModalOpen,   setAdModalOpen]   = useState(false);
    const [selectedOffer, setSelectedOffer] = useState(null);

    // ── Cargar ofertas ────────────────────────────────────────────────────
    const fetchOffers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const data = await offersService.getAll();
            setOffers(Array.isArray(data) ? data : []);
        } catch (err) {
            setError(err.message || 'No se pudieron cargar las ofertas.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchOffers(); }, [fetchOffers]);

    // ── Contadores para los chips de filtro ───────────────────────────────
    const counts = {
        all:     offers.length,
        active:  offers.filter(o => o.status === 'active').length,
        paused:  offers.filter(o => o.status === 'paused').length,
        expired: offers.filter(o => o.status === 'expired').length,
    };

    const filtered = filter === 'all'
        ? offers
        : offers.filter(o => o.status === filter);

    // ── Cambiar estado (pausa / reactiva) ─────────────────────────────────
    const handleSetStatus = async (offer, newStatus) => {
        try {
            await offersService.setStatus(offer.id, newStatus);
            setOffers(prev =>
                prev.map(o => o.id === offer.id ? { ...o, status: newStatus } : o)
            );
        } catch (err) {
            alert(err.message || 'Error al cambiar el estado.');
        }
    };

    // ── Eliminar ──────────────────────────────────────────────────────────
    const handleDelete = async (offer) => {
        if (!window.confirm(`¿Eliminar la oferta "${offer.name}"? Esta acción no se puede deshacer.`))
            return;
        try {
            await offersService.delete(offer.id);
            setOffers(prev => prev.filter(o => o.id !== offer.id));
        } catch (err) {
            alert(err.message || 'Error al eliminar la oferta.');
        }
    };

    const openAdModal = (offer = null) => { setSelectedOffer(offer); setAdModalOpen(true); };

    return (
        <div className="h-full flex overflow-hidden">

            {/* ── Sidebar calendario (desktop) ─────────────────────── */}
            <aside className="hidden lg:flex w-72 shrink-0 border-r border-outline-variant bg-slate-50 flex-col overflow-y-auto custom-scrollbar">
                <div className="p-md space-y-md">
                    <MiniCalendar offers={offers} />

                    {/* Resumen de estados */}
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md">
                        <p className="font-bold text-[11px] text-on-surface-variant uppercase tracking-wide mb-sm">
                            Resumen
                        </p>
                        <div className="space-y-xs">
                            <SummaryRow label="Activas"   value={counts.active}  color="text-green-600" />
                            <SummaryRow label="Pausadas"  value={counts.paused}  color="text-secondary" />
                            <SummaryRow label="Vencidas"  value={counts.expired} color="text-on-surface-variant" />
                        </div>
                    </div>

                    <button
                        onClick={() => openAdModal(null)}
                        className="w-full flex items-center justify-center gap-sm py-md bg-on-tertiary-container text-tertiary-fixed font-headline-md text-headline-md rounded-xl hover:opacity-95 transition-all active:scale-[0.97] shadow-lg"
                    >
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                            auto_awesome
                        </span>
                        Crear Publicidad
                    </button>
                </div>
            </aside>

            {/* ── Lista principal ───────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">

                {/* Barra de filtros */}
                <div className="shrink-0 px-lg py-sm border-b border-outline-variant bg-surface-bright flex items-center justify-between gap-sm">
                    <div className="flex gap-xs overflow-x-auto no-scrollbar">
                        {FILTERS.map(f => {
                            const count  = counts[f.id] ?? 0;
                            const active = filter === f.id;
                            return (
                                <button
                                    key={f.id}
                                    onClick={() => setFilter(f.id)}
                                    className={`flex items-center gap-xs px-md py-xs rounded-full text-[12px] font-medium whitespace-nowrap transition-all ${
                                        active
                                            ? 'bg-secondary/15 text-secondary font-bold'
                                            : 'text-on-surface-variant hover:bg-surface-container-high'
                                    }`}
                                >
                                    {f.label}
                                    {count > 0 && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none ${
                                            active
                                                ? 'bg-secondary text-on-secondary'
                                                : 'bg-surface-container-high text-on-surface-variant'
                                        }`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Acciones móvil */}
                    <div className="lg:hidden flex gap-xs shrink-0">
                        <button
                            onClick={() => openAdModal(null)}
                            className="flex items-center gap-xs px-sm py-xs bg-on-tertiary-container text-tertiary-fixed rounded-lg text-[12px] font-medium"
                        >
                            <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                            <span className="hidden sm:inline">Publicidad</span>
                        </button>
                        <button
                            onClick={onCreateOffer}
                            className="flex items-center gap-xs px-sm py-xs bg-secondary text-on-secondary rounded-lg text-[12px] font-medium"
                        >
                            <span className="material-symbols-outlined text-[15px]">add</span>
                            <span className="hidden sm:inline">Oferta</span>
                        </button>
                    </div>
                </div>

                {/* Contenido */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-lg">

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-[13px] text-error mb-md">
                            <span className="material-symbols-outlined text-[16px]">error</span>
                            {error}
                            <button onClick={fetchOffers} className="ml-auto underline font-medium">
                                Reintentar
                            </button>
                        </div>
                    )}

                    {/* Loading */}
                    {loading ? (
                        <div className="space-y-md max-w-3xl">
                            {[1,2,3].map(i => (
                                <div key={i} className="h-[120px] rounded-2xl bg-surface-container-low animate-pulse" />
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <EmptyState filter={filter} onCreateOffer={onCreateOffer} />
                    ) : (
                        <div className="space-y-md max-w-3xl">
                            {filtered.map(offer => (
                                <OfferCard
                                    key={offer.id}
                                    offer={offer}
                                    onEdit={() => onEditOffer?.(offer)}
                                    onDelete={() => handleDelete(offer)}
                                    onToggleStatus={() =>
                                        handleSetStatus(offer,
                                            offer.status === 'active' ? 'paused' : 'active'
                                        )
                                    }
                                    onCreateAd={() => openAdModal(offer)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <AdCreatorModal
                isOpen={adModalOpen}
                onClose={() => setAdModalOpen(false)}
                offer={selectedOffer}
                offers={offers}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function MiniCalendar({ offers }) {
    const [viewDate, setViewDate] = useState(new Date());
    const year       = viewDate.getFullYear();
    const month      = viewDate.getMonth();
    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today      = new Date();

    const getActiveOffers = (day) => {
        const pad = n => String(n).padStart(2, '0');
        const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
        const dow     = new Date(dateStr).getDay();
        return offers.filter(o => {
            if (o.status !== 'active') return false;
            if (!o.active_days?.includes(dow)) return false;
            if (o.date_start && dateStr < o.date_start) return false;
            if (o.date_end   && dateStr > o.date_end)   return false;
            return true;
        });
    };

    const isToday = d =>
        d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    const cells = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];

    return (
        <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant overflow-hidden">
            <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant">
                <button
                    onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                    className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
                >
                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <p className="font-bold text-[13px] text-on-surface">
                    {MONTH_NAMES[month]} {year}
                </p>
                <button
                    onClick={() => setViewDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                    className="w-7 h-7 rounded-lg hover:bg-surface-container flex items-center justify-center text-on-surface-variant transition-colors"
                >
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
            </div>
            <div className="grid grid-cols-7 px-xs pt-sm pb-xs">
                {DAY_HEADERS.map(d => (
                    <div key={d} className="text-center text-[10px] font-bold text-on-surface-variant py-xs">
                        {d}
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-px px-xs pb-sm">
                {cells.map((day, i) => {
                    if (!day) return <div key={`e-${i}`} />;
                    const dots = getActiveOffers(day);
                    return (
                        <div
                            key={day}
                            className={`relative flex flex-col items-center py-1 rounded-lg ${
                                isToday(day) ? 'bg-secondary/20' : ''
                            }`}
                        >
                            <span className={`text-[11px] font-medium ${
                                isToday(day) ? 'text-secondary font-bold' : 'text-on-surface'
                            }`}>
                                {day}
                            </span>
                            {dots.length > 0 && (
                                <div className="flex gap-0.5 mt-0.5">
                                    {dots.slice(0, 3).map((_, j) => (
                                        <span key={j} className="w-1 h-1 rounded-full bg-secondary" />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="px-md py-xs border-t border-outline-variant flex items-center gap-xs">
                <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />
                <span className="text-[10px] text-on-surface-variant">Oferta activa ese día</span>
            </div>
        </div>
    );
}

function SummaryRow({ label, value, color }) {
    return (
        <div className="flex justify-between items-center text-[13px]">
            <span className="text-on-surface-variant">{label}</span>
            <span className={`font-bold ${color}`}>{value}</span>
        </div>
    );
}

function EmptyState({ filter, onCreateOffer }) {
    const msgs = {
        all:     { title: 'No tienes ofertas aún',      desc: 'Crea tu primera oferta para atraer más clientes.' },
        active:  { title: 'No hay ofertas activas',     desc: 'Activa una oferta existente o crea una nueva.'   },
        paused:  { title: 'No hay ofertas pausadas',    desc: 'Las ofertas pausadas aparecerán aquí.'           },
        expired: { title: 'No hay ofertas vencidas',    desc: 'Las ofertas pasadas aparecerán aquí.'            },
    };
    const { title, desc } = msgs[filter] ?? msgs.all;

    return (
        <div className="flex flex-col items-center justify-center py-16 gap-md text-center">
            <span className="material-symbols-outlined text-[56px] text-outline-variant">
                storefront
            </span>
            <div>
                <p className="font-bold text-[16px] text-on-surface mb-xs">{title}</p>
                <p className="text-[13px] text-on-surface-variant">{desc}</p>
            </div>
            {filter === 'all' && (
                <button
                    onClick={onCreateOffer}
                    className="flex items-center gap-xs px-lg py-sm bg-secondary text-on-secondary rounded-xl font-label-bold text-label-bold hover:bg-secondary/90 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Crear mi primera oferta
                </button>
            )}
        </div>
    );
}