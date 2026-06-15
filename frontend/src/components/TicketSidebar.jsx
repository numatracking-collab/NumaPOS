import { useState, useEffect, useRef } from 'react';
import CheckoutModal from './CheckoutModal';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const OFFER_TYPE_LABEL = {
    '2x1':       (o) => '2 × 1',
    '3x2':       (o) => '3 × 2',
    'nxm':       (o) => `Compra ${o.buy_qty} llévate ${o.get_qty}`,
    'mitad':     (o) => '½ Precio',
    'descuento': (o) => `${o.discount_pct}% OFF`,
};

function getOfferTypeLabel(offer) {
    return OFFER_TYPE_LABEL[offer.type]?.(offer) ?? offer.type;
}

// ─────────────────────────────────────────────────────────────────────────────
// OfferBanner — banner inline que aparece cuando se detecta una oferta
// ─────────────────────────────────────────────────────────────────────────────
function OfferBanner({ pendingOffer, onApply, onDismiss }) {
    const { offer, productName } = pendingOffer;
    const typeLabel = getOfferTypeLabel(offer);

    // Para tipos de precio, advertimos que el total visual puede diferir
    // hasta que el backend soporte descuentos por oferta.
    const isPriceBased = offer.type === 'mitad' || offer.type === 'descuento';

    return (
        <div className="
            mx-md mt-sm mb-0 rounded-xl overflow-hidden
            border border-secondary/30 bg-gradient-to-r from-secondary/10 to-secondary/5
            shadow-sm animate-fade-in
        ">
            {/* Franja superior de color */}
            <div className="h-1 bg-gradient-to-r from-secondary to-secondary/50" />

            <div className="px-md py-sm">
                {/* Encabezado */}
                <div className="flex items-start justify-between gap-sm">
                    <div className="flex items-center gap-xs">
                        <span
                            className="material-symbols-outlined text-[18px] text-secondary shrink-0"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            local_offer
                        </span>
                        <p className="font-bold text-[13px] text-secondary leading-tight">
                            ¡Oferta disponible!
                        </p>
                    </div>
                    <button
                        onClick={onDismiss}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0 -mt-0.5"
                        title="Ignorar oferta"
                    >
                        <span className="material-symbols-outlined text-[15px]">close</span>
                    </button>
                </div>

                {/* Detalle */}
                <div className="mt-xs space-y-0.5">
                    <p className="text-[12px] text-on-surface font-medium leading-snug">
                        <span className="font-bold">{offer.name}</span>
                        <span className="mx-1 text-outline">·</span>
                        <span className="inline-flex items-center px-1.5 py-0.5 bg-secondary/15 text-secondary text-[10px] font-black rounded-full">
                            {typeLabel}
                        </span>
                    </p>
                    <p className="text-[11px] text-on-surface-variant">
                        Aplica a: <span className="font-medium text-on-surface">{productName}</span>
                    </p>
                    {isPriceBased && (
                        <p className="text-[10px] text-secondary/70 flex items-center gap-0.5 mt-xs">
                            <span className="material-symbols-outlined text-[12px]">info</span>
                            El precio con descuento se muestra en el ticket.
                        </p>
                    )}
                </div>

                {/* Acciones */}
                <div className="flex gap-xs mt-sm">
                    <button
                        onClick={onApply}
                        className="
                            flex-1 flex items-center justify-center gap-xs
                            py-xs px-sm bg-secondary text-on-secondary
                            text-[12px] font-bold rounded-lg
                            hover:bg-secondary/90 active:scale-[0.97]
                            transition-all
                        "
                    >
                        <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                        </span>
                        Aplicar oferta
                    </button>
                    <button
                        onClick={onDismiss}
                        className="
                            px-sm py-xs border border-outline-variant
                            text-[12px] font-medium text-on-surface-variant rounded-lg
                            hover:bg-surface-container-high active:scale-[0.97]
                            transition-all
                        "
                    >
                        No, gracias
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// CartItem — fila del carrito con badge de oferta aplicada
// ─────────────────────────────────────────────────────────────────────────────
function CartItem({ item, onUpdateQuantity }) {
    const allowFractions = item.allow_fractions ?? false;
    const unit           = item.unit || 'pza.';
    const step           = allowFractions ? 0.1 : 1;

    const [inputVal, setInputVal] = useState(String(item.quantity));

    useEffect(() => {
        setInputVal(
            allowFractions
                ? String(item.quantity)
                : String(Math.floor(item.quantity))
        );
    }, [item.quantity, allowFractions]);

    const clampMin = (v) => Math.max(allowFractions ? 0.01 : 1, v);
    const round    = (v) => allowFractions
        ? Math.round(v * 1000) / 1000
        : Math.floor(v);

    const commitInput = () => {
        const parsed = parseFloat(inputVal);
        if (isNaN(parsed) || parsed <= 0) { setInputVal(String(item.quantity)); return; }
        const next  = clampMin(round(parsed));
        const delta = next - item.quantity;
        if (Math.abs(delta) > 0.0001) onUpdateQuantity(item.id, delta);
        setInputVal(String(next));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') e.target.blur();
        const allowed = ['Backspace','Delete','ArrowLeft','ArrowRight','Tab','.','-'];
        if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
        if (!allowFractions && e.key === '.') e.preventDefault();
    };

    const handleMinus = () => {
        const next  = clampMin(round(item.quantity - step));
        const delta = next - item.quantity;
        if (Math.abs(delta) > 0.0001) onUpdateQuantity(item.id, delta);
    };

    const handlePlus = () => {
        const next = round(item.quantity + step);
        onUpdateQuantity(item.id, next - item.quantity);
    };

    const subtotal     = item.price * item.quantity;
    const hasOffer     = !!item.appliedOffer;
    const isPriceBased = hasOffer && (item.appliedOffer.type === 'mitad' || item.appliedOffer.type === 'descuento');
    const typeLabel    = hasOffer ? getOfferTypeLabel(item.appliedOffer) : null;

    return (
        <div className="flex gap-3 group animate-fade-in">
            {/* Imagen */}
            <div className="w-16 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                {item.images?.[0]?.url || item.image_url ? (
                    <img
                        className="w-full h-full object-cover"
                        src={item.images?.[0]?.url || item.image_url}
                        alt={item.name}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                        <span className="material-symbols-outlined">image</span>
                    </div>
                )}
            </div>

            {/* Contenido */}
            <div className="flex-1 flex flex-col justify-between min-w-0">
                {/* Nombre + importe */}
                <div className="flex justify-between gap-2 items-start">
                    <span className="font-bold text-[13px] text-on-surface truncate leading-tight">
                        {item.name}
                    </span>
                    <div className="text-right shrink-0">
                        <span className="font-bold text-[14px]">${subtotal.toFixed(2)}</span>
                        {/* Precio original tachado si hay descuento de precio */}
                        {isPriceBased && item.originalPrice && (
                            <p className="text-[10px] text-on-surface-variant line-through">
                                ${(item.originalPrice * item.quantity).toFixed(2)}
                            </p>
                        )}
                    </div>
                </div>

                {/* Precio unitario */}
                <div className="flex items-center gap-xs">
                    <span className="text-[10px] text-on-surface-variant">
                        ${Number(item.price).toFixed(2)} / {unit}
                    </span>
                    {isPriceBased && item.originalPrice && (
                        <span className="text-[10px] text-on-surface-variant line-through">
                            ${Number(item.originalPrice).toFixed(2)}
                        </span>
                    )}
                </div>

                {/* Badge de oferta aplicada */}
                {hasOffer && (
                    <div className="flex items-center gap-xs mt-0.5">
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-full">
                            <span
                                className="material-symbols-outlined text-[11px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                                local_offer
                            </span>
                            {typeLabel} aplicado
                        </span>
                    </div>
                )}

                {/* Controles de cantidad */}
                <div className="flex items-center justify-between mt-1">
                    <div className={`flex items-center rounded-lg border overflow-hidden ${
                        hasOffer
                            ? 'border-secondary/40 bg-secondary/5'
                            : 'border-outline-variant bg-surface-container-low'
                    }`}>
                        <button
                            onClick={handleMinus}
                            className="w-8 h-8 flex items-center justify-center hover:bg-surface-container-high transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <input
                            type="text"
                            inputMode={allowFractions ? 'decimal' : 'numeric'}
                            value={inputVal}
                            onChange={e => setInputVal(e.target.value)}
                            onBlur={commitInput}
                            onKeyDown={handleKeyDown}
                            onFocus={e => e.target.select()}
                            className="w-14 h-8 text-center font-bold text-[13px] bg-transparent focus:outline-none focus:bg-secondary/5 transition-colors"
                        />
                        <button
                            onClick={handlePlus}
                            className="w-8 h-8 flex items-center justify-center hover:bg-surface-container-high transition-colors shrink-0"
                        >
                            <span className="material-symbols-outlined text-sm">add</span>
                        </button>
                    </div>

                    {/* Badge fraccionable + SKU */}
                    <div className="flex flex-col items-end gap-0.5">
                        {allowFractions && (
                            <span className="text-[9px] font-bold text-secondary/70 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">scatter_plot</span>
                                fracción
                            </span>
                        )}
                        <span className="text-on-surface-variant font-mono text-[10px]">
                            {item.sku || '—'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// TicketSidebar
// ─────────────────────────────────────────────────────────────────────────────
export default function TicketSidebar({
    cart,
    products,
    onUpdateQuantity,
    onClearCart,
    onSaleSuccess,
    onAddProduct,
    cajaId,
    serie,
    // ── Props de oferta ──────────────────────────────────────────────────────
    pendingOffer,
    onApplyOffer,
    onDismissOffer,
}) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [nextFolio,   setNextFolio]   = useState(null);

    // ── Búsqueda interna ──────────────────────────────────────────────────────
    const [query,       setQuery]       = useState('');
    const [results,     setResults]     = useState([]);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef(null);
    const inputRef  = useRef(null);
    const lastScan  = useRef('');

    useEffect(() => {
        if (serie) setNextFolio(serie.next_folio);
    }, [serie]);

    // Cerrar resultados al click fuera
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target))
                setShowResults(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Búsqueda reactiva
    useEffect(() => {
        const q = query.trim().toLowerCase();
        if (!q) { setResults([]); setShowResults(false); return; }

        const matches = (products || []).filter(p => {
            const byName = p.name?.toLowerCase().includes(q);
            const bySku  = p.sku?.toLowerCase().includes(q);
            const byKeys = (p.additional_keys || []).some(k => k?.toLowerCase().includes(q));
            return byName || bySku || byKeys;
        }).slice(0, 8);

        setResults(matches);
        setShowResults(true);
    }, [query, products]);

    // Manejar Enter / escaneo
    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const q = query.trim().toLowerCase();
        if (!q) return;

        const exact = (products || []).find(p =>
            p.sku?.toLowerCase() === q ||
            (p.additional_keys || []).some(k => k?.toLowerCase() === q)
        );

        if (exact) {
            if (lastScan.current === exact.id + q) return;
            lastScan.current = exact.id + q;
            setTimeout(() => { lastScan.current = ''; }, 300);
            addProduct(exact);
            return;
        }

        if (results.length === 1) addProduct(results[0]);
    };

    const addProduct = (product) => {
        onAddProduct(product);
        setQuery('');
        setResults([]);
        setShowResults(false);
        inputRef.current?.focus();
    };

    const folioLabel = serie && nextFolio !== null
        ? `${serie.prefix}${String(nextFolio).padStart(4, '0')}`
        : '...';

    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const total    = subtotal;

    const handleFinishSale = () => {
        setIsModalOpen(false);
        onClearCart();
        setNextFolio(prev => prev !== null ? prev + 1 : prev);
        if (onSaleSuccess) onSaleSuccess();
    };

    return (
        <section className="flex-[1.5] flex flex-col bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.05)] z-20">

            {/* ── Header: folio + borrar ── */}
            <div className="px-md pt-md pb-2 border-b border-outline-variant bg-slate-50">
                <div className="flex justify-between items-center mb-2">
                    <h2 className="font-headline-md text-headline-md text-on-surface">
                        Ticket #{folioLabel}
                    </h2>
                    <button
                        onClick={onClearCart}
                        disabled={cart.length === 0}
                        className="p-xs text-error hover:bg-error-container rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined">delete_sweep</span>
                    </button>
                </div>

                {/* Barra de búsqueda / escaneo */}
                <div className="relative" ref={searchRef}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-outline-variant rounded-xl focus-within:ring-2 focus-within:ring-secondary focus-within:border-secondary transition-all">
                        <span className="material-symbols-outlined text-[18px] text-outline shrink-0">
                            qr_code_scanner
                        </span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => results.length > 0 && setShowResults(true)}
                            placeholder="Escanear o buscar producto..."
                            className="flex-1 text-[13px] bg-transparent focus:outline-none text-on-surface placeholder:text-outline-variant"
                        />
                        {query && (
                            <button
                                onClick={() => { setQuery(''); setResults([]); setShowResults(false); inputRef.current?.focus(); }}
                                className="shrink-0"
                            >
                                <span className="material-symbols-outlined text-[16px] text-outline hover:text-on-surface transition-colors">close</span>
                            </button>
                        )}
                    </div>

                    {/* Resultados dropdown */}
                    {showResults && results.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-outline-variant/50 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
                            {results.map(p => {
                                const img  = p.images?.[0]?.url || p.image_url;
                                const unit = p.unit || 'pza.';
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => addProduct(p)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container-low transition-colors text-left border-b border-outline-variant/20 last:border-none"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-surface-container-low border border-outline-variant/30 overflow-hidden shrink-0 flex items-center justify-center">
                                            {img
                                                ? <img src={img} alt={p.name} className="w-full h-full object-cover" />
                                                : <span className="material-symbols-outlined text-[16px] text-outline">image</span>
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-on-surface truncate">{p.name}</p>
                                            <p className="text-[11px] text-outline font-mono">{p.sku || '—'}</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[13px] font-bold text-secondary">${Number(p.price).toFixed(2)}</p>
                                            <p className="text-[10px] text-outline">{p.stock} {unit}</p>
                                            {p.allow_fractions && (
                                                <span className="text-[9px] font-bold text-secondary/60 flex items-center justify-end gap-0.5">
                                                    <span className="material-symbols-outlined text-[10px]">scatter_plot</span>
                                                    fracción
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Sin resultados */}
                    {showResults && query.trim() && results.length === 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-outline-variant/50 rounded-xl shadow-xl z-50 px-4 py-3 text-[13px] text-on-surface-variant flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">search_off</span>
                            Sin resultados para "{query}"
                        </div>
                    )}
                </div>
            </div>

            {/* ── Banner de oferta detectada ── */}
            {pendingOffer && (
                <OfferBanner
                    pendingOffer={pendingOffer}
                    onApply={onApplyOffer}
                    onDismiss={onDismissOffer}
                />
            )}

            {/* ── Items del carrito ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-md space-y-md">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-outline-variant">
                        <span className="material-symbols-outlined text-[64px] mb-2">shopping_cart</span>
                        <p className="font-medium text-lg">El carrito está vacío</p>
                    </div>
                ) : (
                    cart.map(item => (
                        <CartItem
                            key={item.id}
                            item={item}
                            onUpdateQuantity={onUpdateQuantity}
                        />
                    ))
                )}
            </div>

            {/* ── Totales y cobrar ── */}
            <div className="p-lg bg-surface-container-lowest border-t border-outline-variant space-y-md">
                <div className="space-y-sm">
                    <div className="flex justify-between text-on-surface-variant font-body-sm text-body-sm">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="pt-sm border-t border-slate-100 flex justify-between items-end">
                        <span className="font-headline-md text-headline-md">Total</span>
                        <span className="font-display-price text-display-price text-secondary">
                            ${total.toFixed(2)}
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={cart.length === 0}
                    className="w-full py-md bg-on-tertiary-container text-tertiary-fixed font-headline-md text-headline-md rounded-xl flex items-center justify-center gap-md hover:opacity-95 transition-all active:scale-[0.97] shadow-lg shadow-tertiary/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                >
                    <span className="material-symbols-outlined">payments</span>
                    Cobrar
                </button>

                <div className="flex gap-sm">
                    <button className="flex-1 py-sm bg-white border border-outline-variant text-on-surface font-label-bold text-label-bold rounded-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-xs">
                        <span className="material-symbols-outlined text-sm">group_add</span>
                        Cliente
                    </button>
                </div>
            </div>

            <CheckoutModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                cart={cart}
                total={total}
                onFinishSale={handleFinishSale}
                cajaId={cajaId}
            />
        </section>
    );
}