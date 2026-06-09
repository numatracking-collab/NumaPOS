/* ═══════════════════════════════════════════════════════════════════════════
   CreateOfferPanel.jsx — Crear / editar oferta conectado a offersService
   Props:
     onSaved(offer)       — callback al guardar exitosamente
     initialOffer         — si se pasa, entra en modo edición
═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect } from 'react';
import { offersService } from '../../services/api';
import ProductPicker     from './ProductPicker';

const OFFER_TYPES = [
    { id: '2x1',       label: '2 × 1',              desc: 'Compra 2, llévate 2, paga 1', icon: 'content_copy' },
    { id: '3x2',       label: '3 × 2',              desc: 'Compra 3, llévate 3, paga 2', icon: 'redeem'       },
    { id: 'nxm',       label: 'Compra X llévate Y', desc: 'Configura tu propio combo',   icon: 'swap_horiz'   },
    { id: 'mitad',     label: '½ Precio',            desc: '50% de descuento automático', icon: 'percent'      },
    { id: 'descuento', label: 'Descuento %',          desc: 'Porcentaje personalizado',    icon: 'sell'         },
];

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function CreateOfferPanel({ onSaved, initialOffer = null }) {
    const isEditing = !!initialOffer;

    // ── Estado del formulario ─────────────────────────────────────────────
    const [offerType,        setOfferType]        = useState(initialOffer?.type        ?? null);
    const [offerName,        setOfferName]        = useState(initialOffer?.name        ?? '');
    const [selectedProducts, setSelectedProducts] = useState(initialOffer?.products    ?? []);
    const [selectedDays,     setSelectedDays]     = useState(initialOffer?.active_days ?? [1,2,3,4,5]);
    const [timeStart,        setTimeStart]        = useState(initialOffer?.time_start  ?? '08:00');
    const [timeEnd,          setTimeEnd]          = useState(initialOffer?.time_end    ?? '21:00');
    const [dateStart,        setDateStart]        = useState(initialOffer?.date_start  ?? '');
    const [dateEnd,          setDateEnd]          = useState(initialOffer?.date_end    ?? '');
    const [buyQty,           setBuyQty]           = useState(initialOffer?.buy_qty     ?? 3);
    const [getQty,           setGetQty]           = useState(initialOffer?.get_qty     ?? 1);
    const [discountPct,      setDiscountPct]      = useState(initialOffer?.discount_pct ?? 15);
    const [status,           setStatus]           = useState(initialOffer?.status      ?? 'active');

    const [saving,  setSaving]  = useState(false);
    const [saveErr, setSaveErr] = useState('');

    // Si cambia initialOffer (p.ej. al entrar en modo edición), re-inicializar
    useEffect(() => {
        if (initialOffer) {
            setOfferType(initialOffer.type);
            setOfferName(initialOffer.name);
            setSelectedProducts(initialOffer.products ?? []);
            setSelectedDays(initialOffer.active_days  ?? [1,2,3,4,5]);
            setTimeStart(initialOffer.time_start ?? '08:00');
            setTimeEnd(initialOffer.time_end     ?? '21:00');
            setDateStart(initialOffer.date_start ?? '');
            setDateEnd(initialOffer.date_end     ?? '');
            setBuyQty(initialOffer.buy_qty       ?? 3);
            setGetQty(initialOffer.get_qty       ?? 1);
            setDiscountPct(initialOffer.discount_pct ?? 15);
            setStatus(initialOffer.status        ?? 'active');
        }
    }, [initialOffer?.id]);

    const canSave = offerType && selectedProducts.length > 0 && offerName.trim();

    const toggleDay = (i) =>
        setSelectedDays(prev =>
            prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
        );

    // ── Guardar ───────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        setSaveErr('');

        const body = {
            name:         offerName.trim(),
            type:         offerType,
            discount_pct: offerType === 'descuento' ? discountPct : null,
            buy_qty:      offerType === 'nxm'        ? buyQty      : null,
            get_qty:      offerType === 'nxm'        ? getQty      : null,
            date_start:   dateStart  || null,
            date_end:     dateEnd    || null,
            time_start:   timeStart  || null,
            time_end:     timeEnd    || null,
            active_days:  selectedDays,
            status,
            product_ids:  selectedProducts.map(p => p.id),
        };

        try {
            let result;
            if (isEditing) {
                result = await offersService.update(initialOffer.id, body);
            } else {
                result = await offersService.create(body);
            }
            if (onSaved) onSaved(result.offer);
        } catch (err) {
            setSaveErr(err.message || 'No se pudo guardar la oferta.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full flex overflow-hidden">

            {/* ════ Formulario ════ */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-lg space-y-lg">

                {/* Error al guardar */}
                {saveErr && (
                    <div className="flex items-start gap-2 bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-[13px] text-error">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-px">error</span>
                        <span>{saveErr}</span>
                    </div>
                )}

                {/* ── Nombre ── */}
                <section>
                    <SectionLabel>Nombre de la oferta</SectionLabel>
                    <input
                        type="text"
                        value={offerName}
                        onChange={e => setOfferName(e.target.value)}
                        placeholder="Ej. Promo fin de semana refrescos"
                        className="w-full px-md py-sm bg-surface-container-low border border-outline-variant rounded-xl text-body-md focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                    />
                </section>

                {/* ── Tipo ── */}
                <section>
                    <SectionLabel>Tipo de oferta</SectionLabel>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-sm">
                        {OFFER_TYPES.map(type => {
                            const active = offerType === type.id;
                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setOfferType(type.id)}
                                    className={`p-md rounded-xl border-2 text-left transition-all flex flex-col gap-xs ${
                                        active
                                            ? 'border-secondary bg-secondary/10 shadow-sm'
                                            : 'border-outline-variant bg-surface-container-lowest hover:border-secondary/40 hover:bg-secondary/5'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                        active ? 'bg-secondary text-on-secondary' : 'bg-surface-container-low text-on-surface-variant'
                                    }`}>
                                        <span className="material-symbols-outlined text-[18px]">{type.icon}</span>
                                    </div>
                                    <div>
                                        <p className={`font-bold text-[13px] ${active ? 'text-secondary' : 'text-on-surface'}`}>
                                            {type.label}
                                        </p>
                                        <p className="text-[11px] text-on-surface-variant leading-tight">{type.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* ── Parámetros según tipo ── */}
                {offerType && (
                    <section>
                        <SectionLabel>Parámetros</SectionLabel>
                        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-md">
                            {offerType === '2x1' && (
                                <p className="text-[13px] text-on-surface-variant">
                                    El cliente compra <strong>2 unidades</strong> y paga solo 1.
                                    El segundo artículo sale completamente gratis.
                                </p>
                            )}
                            {offerType === '3x2' && (
                                <p className="text-[13px] text-on-surface-variant">
                                    El cliente compra <strong>3 unidades</strong> y paga solo 2.
                                    El artículo de menor precio sale gratis.
                                </p>
                            )}
                            {offerType === 'mitad' && (
                                <p className="text-[13px] text-on-surface-variant">
                                    El producto se vende al <strong>50% de su precio</strong> de catálogo de forma automática.
                                </p>
                            )}
                            {offerType === 'nxm' && (
                                <div className="flex items-center gap-md">
                                    <QtyControl label="Compra"        value={buyQty} onChange={setBuyQty} />
                                    <span className="material-symbols-outlined text-outline text-[22px] mt-5">
                                        arrow_forward
                                    </span>
                                    <QtyControl label="Llévate gratis" value={getQty} onChange={setGetQty} />
                                </div>
                            )}
                            {offerType === 'descuento' && (
                                <div>
                                    <label className="text-[11px] text-on-surface-variant mb-sm block">
                                        Porcentaje de descuento
                                    </label>
                                    <div className="flex items-center gap-md">
                                        <input
                                            type="range" min="5" max="90" step="5"
                                            value={discountPct}
                                            onChange={e => setDiscountPct(Number(e.target.value))}
                                            className="flex-1 accent-secondary"
                                        />
                                        <span className="font-headline-md text-headline-md text-secondary w-14 text-right">
                                            {discountPct}%
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-on-surface-variant mt-xs">
                                        <span>5%</span><span>90%</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* ── Productos en oferta ── */}
                <section>
                    <SectionLabel>Productos en oferta</SectionLabel>
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md">
                        <ProductPicker
                            selectedProducts={selectedProducts}
                            onChange={setSelectedProducts}
                        />
                    </div>
                </section>

                {/* ── Vigencia y horario ── */}
                <section>
                    <SectionLabel>Vigencia y horario</SectionLabel>
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md space-y-md">
                        <div className="grid grid-cols-2 gap-sm">
                            <div>
                                <label className="text-[11px] text-on-surface-variant mb-xs block">Fecha inicio</label>
                                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)}
                                    className="w-full px-sm py-xs bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary" />
                            </div>
                            <div>
                                <label className="text-[11px] text-on-surface-variant mb-xs block">Fecha fin</label>
                                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)}
                                    className="w-full px-sm py-xs bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary" />
                            </div>
                        </div>

                        <div>
                            <label className="text-[11px] text-on-surface-variant mb-sm block">Días activos</label>
                            <div className="flex gap-xs">
                                {DAYS.map((day, i) => (
                                    <button
                                        key={i}
                                        onClick={() => toggleDay(i)}
                                        aria-pressed={selectedDays.includes(i)}
                                        className={`flex-1 py-sm rounded-lg font-bold text-[10px] transition-all ${
                                            selectedDays.includes(i)
                                                ? 'bg-secondary text-on-secondary shadow-sm'
                                                : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container border border-outline-variant'
                                        }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-sm">
                            <div>
                                <label className="text-[11px] text-on-surface-variant mb-xs block">Hora inicio</label>
                                <input type="time" value={timeStart} onChange={e => setTimeStart(e.target.value)}
                                    className="w-full px-sm py-xs bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary" />
                            </div>
                            <div>
                                <label className="text-[11px] text-on-surface-variant mb-xs block">Hora fin</label>
                                <input type="time" value={timeEnd} onChange={e => setTimeEnd(e.target.value)}
                                    className="w-full px-sm py-xs bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-secondary" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Botón guardar ── */}
                <button
                    onClick={handleSave}
                    disabled={!canSave || saving}
                    className="
                        w-full py-md bg-on-tertiary-container text-tertiary-fixed
                        font-headline-md text-headline-md rounded-xl
                        flex items-center justify-center gap-md
                        hover:opacity-95 transition-all active:scale-[0.97] shadow-lg
                        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 mb-lg
                    "
                >
                    {saving ? (
                        <>
                            <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
                            Guardando…
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined">save</span>
                            {isEditing ? 'Guardar cambios' : 'Guardar Oferta'}
                        </>
                    )}
                </button>
            </div>

            {/* ════ Vista previa (solo desktop) ════ */}
            <aside className="hidden md:flex w-80 shrink-0 border-l border-outline-variant bg-slate-50 flex-col overflow-y-auto custom-scrollbar p-lg gap-md">
                <SectionLabel>Vista previa</SectionLabel>
                <OfferPreviewCard
                    type={offerType}
                    name={offerName}
                    products={selectedProducts}
                    days={selectedDays}
                    timeStart={timeStart}
                    timeEnd={timeEnd}
                    buyQty={buyQty}
                    getQty={getQty}
                    discountPct={discountPct}
                />
            </aside>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de UI
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children, className = '' }) {
    return (
        <p className={`font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wide text-[11px] mb-sm ${className}`}>
            {children}
        </p>
    );
}

function QtyControl({ label, value, onChange }) {
    return (
        <div className="flex-1">
            <label className="text-[11px] text-on-surface-variant mb-xs block">{label}</label>
            <div className="flex items-center border border-outline-variant rounded-lg overflow-hidden bg-surface-container-low">
                <button
                    onClick={() => onChange(q => Math.max(1, q - 1))}
                    className="w-9 h-9 flex items-center justify-center hover:bg-surface-container-high transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">remove</span>
                </button>
                <span className="flex-1 text-center font-bold text-[15px] text-on-surface">{value}</span>
                <button
                    onClick={() => onChange(q => q + 1)}
                    className="w-9 h-9 flex items-center justify-center hover:bg-surface-container-high transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                </button>
            </div>
        </div>
    );
}

const DAYS_SHORT = ['D','L','M','X','J','V','S'];

function OfferPreviewCard({ type, name, products, days, timeStart, timeEnd, buyQty, getQty, discountPct }) {
    const getTypeLabel = () => {
        if (!type) return null;
        if (type === '2x1')       return '2 × 1';
        if (type === '3x2')       return '3 × 2';
        if (type === 'nxm')       return `Compra ${buyQty} llévate ${getQty}`;
        if (type === 'mitad')     return '½ Precio';
        if (type === 'descuento') return `${discountPct}% OFF`;
        return null;
    };

    const badgeStyle = (!type || type === 'mitad' || type === 'descuento')
        ? 'bg-error text-on-error'
        : 'bg-secondary text-on-secondary';

    if (!type && !name && products.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-sm text-on-surface-variant opacity-40 py-12">
                <span className="material-symbols-outlined text-[48px]">local_offer</span>
                <p className="text-[12px] text-center">
                    Configura la oferta<br />para ver la vista previa
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-outline-variant overflow-hidden shadow-md">
            <div className="relative bg-gradient-to-br from-secondary to-secondary/60 p-md min-h-[100px] flex items-end">
                {getTypeLabel() && (
                    <span className={`absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 rounded-full ${badgeStyle}`}>
                        {getTypeLabel()}
                    </span>
                )}
                <div className="flex gap-xs">
                    {products.slice(0, 3).map(p => {
                        const img = p.images?.[0]?.url || p.image_url || null;
                        return (
                            <div key={p.id} className="w-14 h-14 bg-white/20 rounded-xl overflow-hidden flex items-center justify-center">
                                {img
                                    ? <img src={img} alt={p.name} className="w-full h-full object-cover" />
                                    : <span className="material-symbols-outlined text-white text-[22px]">image</span>
                                }
                            </div>
                        );
                    })}
                    {products.length === 0 && (
                        <span className="material-symbols-outlined text-white/40 text-[40px]">photo_camera</span>
                    )}
                </div>
            </div>
            <div className="p-md space-y-sm">
                <p className="font-bold text-[15px] text-on-surface">
                    {name || <span className="text-on-surface-variant/50 italic">Nombre de la oferta</span>}
                </p>
                {products.length > 0 && (
                    <div className="flex flex-wrap gap-xs">
                        {products.map(p => (
                            <span key={p.id} className="text-[10px] bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-full border border-outline-variant/30 max-w-[100px] truncate">
                                {p.name}
                            </span>
                        ))}
                    </div>
                )}
                {days.length > 0 && (
                    <div className="flex gap-1">
                        {DAYS_SHORT.map((d, i) => (
                            <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                days.includes(i) ? 'bg-secondary/20 text-secondary' : 'text-on-surface-variant/30'
                            }`}>
                                {d}
                            </span>
                        ))}
                    </div>
                )}
                <p className="text-[11px] text-outline font-mono">{timeStart} – {timeEnd}</p>
            </div>
        </div>
    );
}