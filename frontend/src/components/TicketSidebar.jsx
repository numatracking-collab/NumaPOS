import { useState, useEffect, useRef } from 'react';
import CheckoutModal from './CheckoutModal';

export default function TicketSidebar({
    cart,
    products,          // lista completa de productos del POS
    onUpdateQuantity,
    onClearCart,
    onSaleSuccess,
    onAddProduct,      // (product) => void
    cajaId,
    serie,
}) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [nextFolio,   setNextFolio]   = useState(null);

    // ── Búsqueda interna ──────────────────────────────────────────────────────
    const [query,       setQuery]       = useState('');
    const [results,     setResults]     = useState([]);
    const [showResults, setShowResults] = useState(false);
    const searchRef  = useRef(null);
    const inputRef   = useRef(null);
    const lastScan   = useRef('');   // evita doble-escaneo del mismo código

    useEffect(() => {
        if (serie) setNextFolio(serie.next_folio);
    }, [serie]);

    // ── Cerrar resultados al click fuera ─────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target))
                setShowResults(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Búsqueda reactiva ─────────────────────────────────────────────────────
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

    // ── Manejar Enter / escaneo ───────────────────────────────────────────────
    const handleKeyDown = (e) => {
        if (e.key !== 'Enter') return;
        const q = query.trim().toLowerCase();
        if (!q) return;

        // Escaneo exacto por SKU o clave adicional
        const exact = (products || []).find(p =>
            p.sku?.toLowerCase() === q ||
            (p.additional_keys || []).some(k => k?.toLowerCase() === q)
        );

        if (exact) {
            // Evitar doble-escaneo del mismo código en < 300ms
            if (lastScan.current === exact.id + q) return;
            lastScan.current = exact.id + q;
            setTimeout(() => { lastScan.current = ''; }, 300);

            addProduct(exact);
            return;
        }

        // Si solo hay un resultado, agregarlo directamente
        if (results.length === 1) {
            addProduct(results[0]);
        }
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

                {/* ── Barra de búsqueda / escaneo ── */}
                <div className="relative" ref={searchRef}>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white border border-outline-variant rounded-xl focus-within:ring-2 focus-within:ring-secondary focus-within:border-secondary transition-all">
                        <span className="material-symbols-outlined text-[18px] text-outline shrink-0">
                            qr_code_scanner
                        </span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
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
                                const img = p.images?.[0]?.url || p.image_url;
                                return (
                                    <button
                                        key={p.id}
                                        onClick={() => addProduct(p)}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-container-low transition-colors text-left border-b border-outline-variant/20 last:border-none"
                                    >
                                        {/* Thumbnail */}
                                        <div className="w-9 h-9 rounded-lg bg-surface-container-low border border-outline-variant/30 overflow-hidden shrink-0 flex items-center justify-center">
                                            {img
                                                ? <img src={img} alt={p.name} className="w-full h-full object-cover" />
                                                : <span className="material-symbols-outlined text-[16px] text-outline">image</span>
                                            }
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-on-surface truncate">{p.name}</p>
                                            <p className="text-[11px] text-outline font-mono">{p.sku || '—'}</p>
                                        </div>
                                        {/* Precio + stock */}
                                        <div className="text-right shrink-0">
                                            <p className="text-[13px] font-bold text-secondary">${Number(p.price).toFixed(2)}</p>
                                            <p className="text-[10px] text-outline">{p.stock} pzs</p>
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

            {/* ── Items del carrito ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-md space-y-md">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-outline-variant">
                        <span className="material-symbols-outlined text-[64px] mb-2">shopping_cart</span>
                        <p className="font-medium text-lg">El carrito está vacío</p>
                    </div>
                ) : (
                    cart.map((item) => (
                        <div key={item.id} className="flex gap-md group animate-fade-in">
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

                            <div className="flex-1 flex flex-col justify-between">
                                <div className="flex justify-between gap-3">
                                    <span className="font-label-bold text-label-bold text-on-surface block truncate max-w-[150px]">
                                        {item.name}
                                    </span>
                                    <span className="font-body-md text-body-md font-bold">
                                        ${(item.price * item.quantity).toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center bg-surface-container-low rounded-lg border border-outline-variant">
                                        <button
                                            onClick={() => onUpdateQuantity(item.id, -1)}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-surface-container-high rounded-l-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm">remove</span>
                                        </button>
                                        <span className="w-10 text-center font-label-bold text-label-bold">
                                            {item.quantity}
                                        </span>
                                        <button
                                            onClick={() => onUpdateQuantity(item.id, 1)}
                                            className="w-8 h-8 flex items-center justify-center hover:bg-surface-container-high rounded-r-lg transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-sm">add</span>
                                        </button>
                                    </div>
                                    <span className="text-on-surface-variant font-label-mono text-[10px]">
                                        SKU: {item.sku}
                                    </span>
                                </div>
                            </div>
                        </div>
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