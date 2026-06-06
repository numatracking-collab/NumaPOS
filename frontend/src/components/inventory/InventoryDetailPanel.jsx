import { useState, useEffect, useRef } from 'react';
import { inventoryService } from '../../services/api';

export default function InventoryDetailPanel({ product, onStockAdjusted, onBack }) {
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [adjustForm, setAdjustForm] = useState({ type: 'IN', quantity: '', reason: 'ingreso de mercancia' });
    const [error, setError] = useState('');
    const menuRef = useRef(null);

    useEffect(() => {
        if (product) {
            loadAdjustments(product.id);
            setAdjustForm({ type: 'IN', quantity: '', reason: 'ingreso de mercancia' });
            setError('');
            setHistoryOpen(false);
        }
    }, [product]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadAdjustments = async (productId) => {
        setLoading(true);
        try {
            const data = await inventoryService.getProductHistory(productId);
            setAdjustments(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const openAdjustModal = (type) => {
        const defaultReason = type === 'IN' ? 'ingreso de mercancia' : 'merma';
        setAdjustForm({ type, quantity: '', reason: defaultReason });
        setError('');
        setMenuOpen(false);
        setModalOpen(true);
    };

    const handleAdjustSubmit = async () => {
        setError('');
        if (!adjustForm.quantity || isNaN(adjustForm.quantity) || Number(adjustForm.quantity) <= 0) {
            setError('Por favor, ingresa una cantidad válida que sea mayor a cero (0).');
            return;
        }
        try {
            const data = await inventoryService.createAdjustment({
                product_id: product.id,
                type: adjustForm.type,
                quantity: Number(adjustForm.quantity),
                reason: adjustForm.reason,
            });
            setModalOpen(false);
            loadAdjustments(product.id);
            setHistoryOpen(true);
            if (onStockAdjusted) onStockAdjusted(data.newStock);
        } catch (err) {
            setError(err.message || 'Ocurrió un error al intentar guardar el ajuste.');
        }
    };

    const stock = product?.stock ?? 0;
    const min = product?.stock_min ?? null;
    const max = product?.stock_max ?? null;
    const isLowStock = min !== null ? stock < min : stock <= 5;
    const isOverStock = max !== null && stock > max;

    if (!product) {
        return (
            // Ocultamos el panel vacío en celular (hidden md:flex) para que puedan ver la lista
            <section className="hidden md:flex flex-[1.5] flex-col bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.05)] z-20 items-center justify-center p-8 text-center gap-4">
                <span className="material-symbols-outlined text-[80px] text-outline-variant">inventory_2</span>
                <p className="text-on-surface-variant text-xl font-medium leading-relaxed max-w-[300px]">
                    Selecciona un producto de la lista para ver sus detalles completos y ajustar su inventario.
                </p>
            </section>
        );
    }

    return (
        <section className={`
            flex flex-col bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.05)] overflow-hidden
            fixed inset-0 z-50 w-full h-full                   /* CELULAR: Pantalla completa y encima de todo */
            md:relative md:inset-auto md:z-20 md:flex-[1.5] md:border-l md:border-outline-variant/30 /* ESCRITORIO: Panel lateral */
        `}>

            {/* ── Image hero ── */}
            <div className="relative h-48 md:h-56 bg-surface-container-low flex-shrink-0 flex items-center justify-center overflow-hidden">

                {/* Botón de Regresar (Solo visible en celular gracias a md:hidden) */}
                {onBack && (
                    <div className="absolute top-3 left-3 z-20 md:hidden">
                        <button
                            onClick={onBack}
                            className="h-12 px-4 rounded-full bg-white/95 border-2 border-outline-variant/40 flex items-center justify-center gap-2 hover:bg-white transition-colors shadow-lg text-on-surface"
                            aria-label="Regresar a la lista"
                        >
                            <span className="material-symbols-outlined text-[28px]">arrow_back</span>
                            <span className="text-base font-bold">Regresar</span>
                        </button>
                    </div>
                )}

                {product.images?.[0]?.url || product.image_url ? (
                    <img
                        src={product.images?.[0]?.url || product.image_url}
                        alt={`Fotografía de ${product.name}`}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="flex flex-col items-center gap-3 text-outline mt-8">
                        <span className="material-symbols-outlined text-[64px]">inventory_2</span>
                        <span className="text-lg font-medium">No tiene fotografía</span>
                    </div>
                )}

                {/* 3-dot menu */}
                <div className="absolute top-3 right-3 z-10" ref={menuRef}>
                    <button
                        onClick={() => setMenuOpen((v) => !v)}
                        className="w-12 h-12 rounded-full bg-white/95 border-2 border-outline-variant/40 flex items-center justify-center hover:bg-white transition-colors shadow-md"
                        aria-label="Abrir opciones de ajuste de inventario"
                        aria-expanded={menuOpen}
                    >
                        <span className="material-symbols-outlined text-[28px] text-on-surface">more_vert</span>
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 top-14 w-72 max-w-[90vw] bg-white border-2 border-outline-variant/40 rounded-xl shadow-2xl z-30 overflow-hidden py-1">
                            <p className="px-4 pt-3 pb-2 text-sm font-bold text-outline uppercase tracking-widest border-b border-outline-variant/30">
                                Ajuste de inventario
                            </p>
                            <button
                                onClick={() => openAdjustModal('IN')}
                                className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
                            >
                                <span className="material-symbols-outlined text-[28px] text-tertiary">add_circle</span>
                                Registrar entrada (+)
                            </button>
                            <button
                                onClick={() => openAdjustModal('OUT')}
                                className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left border-t border-outline-variant/20"
                            >
                                <span className="material-symbols-outlined text-[28px] text-error">remove_circle</span>
                                Registrar salida (−)
                            </button>
                            <button
                                onClick={() => openAdjustModal('IN')}
                                className="w-full flex items-center gap-4 px-4 py-4 text-lg font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left border-t border-outline-variant/20"
                            >
                                <span className="material-symbols-outlined text-[28px] text-secondary">tune</span>
                                Corrección de error
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Todo el contenido debajo de la imagen tiene overflow-y-auto para que se pueda scrollear en celular si la pantalla es muy corta */}
            <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar pb-6 md:pb-0">

                {/* ── Product info ── */}
                <div className="px-5 py-5 border-b border-outline-variant/30 flex-shrink-0 flex flex-col gap-4">
                    <div>
                        <h2 className="font-black text-2xl md:text-3xl text-on-surface leading-tight mb-3">
                            {product.name}
                        </h2>

                        <div className="flex flex-wrap items-center gap-3">
                            {product.department && (
                                <span className="inline-flex items-center gap-1.5 text-base font-bold px-3 py-1.5 rounded-md bg-secondary-container text-on-secondary-container">
                                    <span className="material-symbols-outlined text-[20px]">storefront</span>
                                    {product.department}
                                </span>
                            )}
                            <span className="font-mono text-base font-bold text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-md">
                                Código: {product.sku || 'Sin código'}
                            </span>
                        </div>
                    </div>

                    {/* Tarjeta de Precios */}
                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 bg-surface-container-lowest border-2 border-outline-variant/30 rounded-xl p-4">
                        <div className="border-b-2 sm:border-b-0 sm:border-r-2 border-outline-variant/30 pb-3 sm:pb-0 sm:pr-4">
                            <p className="text-sm font-bold text-on-surface-variant uppercase mb-1">Costo al proveedor</p>
                            <p className="text-xl font-bold text-on-surface">
                                ${Number(product.cost ?? 0).toFixed(2)}
                            </p>
                        </div>
                        <div className="sm:pl-2">
                            <p className="text-sm font-bold text-secondary uppercase mb-1">Precio al público</p>
                            <p className="text-2xl font-black text-secondary">
                                ${Number(product.price ?? 0).toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Stock count ── */}
                <div className="px-5 py-5 flex items-center justify-between border-b border-outline-variant/30 bg-surface flex-shrink-0">
                    <div className="flex items-center gap-3 text-xl font-bold text-on-surface-variant">
                        <span className="material-symbols-outlined text-[32px]">package_2</span>
                        <span className="hidden sm:inline">Piezas en tienda:</span>
                        <span className="sm:hidden">En tienda:</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[48px] font-black text-on-surface leading-none">{stock}</span>
                        <span className="text-lg font-bold text-outline">piezas</span>
                    </div>
                </div>

                {/* ── Min / Max limits ── */}
                {(min !== null || max !== null) && (
                    <div className="grid grid-cols-2 divide-x-2 divide-outline-variant/30 border-b border-outline-variant/30 flex-shrink-0 bg-surface-container-low">
                        <div className="px-5 py-4 flex flex-col gap-1">
                            <span className="text-sm font-bold text-outline-variant uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[20px]">arrow_downward</span>
                                Mínimo permitido
                            </span>
                            <span className="text-2xl font-black text-on-surface">{min ?? 'No asignado'}</span>
                        </div>
                        <div className="px-5 py-4 flex flex-col gap-1">
                            <span className="text-sm font-bold text-outline-variant uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                                Máximo permitido
                            </span>
                            <span className="text-2xl font-black text-on-surface">{max ?? 'No asignado'}</span>
                        </div>
                    </div>
                )}

                {/* ── Stock alert banners ── */}
                {isLowStock && (
                    <div className="mx-5 my-3 px-4 py-4 rounded-xl bg-error-container flex items-start gap-3 flex-shrink-0 border border-error/20">
                        <span className="material-symbols-outlined text-[28px] text-error mt-0.5">warning</span>
                        <p className="text-base font-bold text-on-error-container leading-snug">
                            ¡Atención! Hay muy pocas piezas de este producto. Se recomienda surtir pronto.
                        </p>
                    </div>
                )}
                {isOverStock && (
                    <div className="mx-5 my-3 px-4 py-4 rounded-xl bg-primary-container flex items-start gap-3 flex-shrink-0 border border-primary/20">
                        <span className="material-symbols-outlined text-[28px] text-primary mt-0.5">info</span>
                        <p className="text-base font-bold text-on-primary-container leading-snug">
                            ¡Aviso! Tienes más piezas de las recomendadas ocupando espacio.
                        </p>
                    </div>
                )}

                {/* ── Collapsible history ── */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <button
                        onClick={() => setHistoryOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-5 py-4 border-y border-outline-variant/30 hover:bg-surface-container-low transition-colors flex-shrink-0"
                        aria-expanded={historyOpen}
                    >
                        <div className="flex items-center gap-3 text-lg font-bold text-on-surface">
                            <span className="material-symbols-outlined text-[28px] text-on-surface-variant">history</span>
                            Historial de cambios
                            {adjustments.length > 0 && (
                                <span className="text-sm bg-secondary-container text-on-secondary-container font-black px-3 py-1 rounded-full">
                                    {adjustments.length}
                                </span>
                            )}
                        </div>
                        <span
                            className="material-symbols-outlined text-[32px] text-outline transition-transform duration-200"
                            style={{ transform: historyOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                            expand_more
                        </span>
                    </button>

                    {historyOpen && (
                        <div className="flex-1">
                            {loading ? (
                                <div className="text-center text-on-surface-variant py-8 text-lg font-medium">Cargando historial…</div>
                            ) : adjustments.length === 0 ? (
                                <div className="text-center text-outline-variant py-8 text-lg font-medium">Aún no hay cambios registrados en este producto.</div>
                            ) : (
                                adjustments.map((adj) => (
                                    <div key={adj.id} className="flex items-center gap-4 px-5 py-4 border-b border-outline-variant/20 last:border-none">
                                        <span className={`text-lg font-black px-3 py-1.5 rounded-lg shrink-0 w-16 text-center ${adj.type === 'IN'
                                            ? 'bg-tertiary-container text-tertiary-dark'
                                            : 'bg-error-container text-error-dark'
                                            }`}>
                                            {adj.type === 'IN' ? '+' : '−'}{adj.quantity}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-base font-bold text-on-surface capitalize truncate">{adj.reason}</p>
                                            <p className="text-sm font-medium text-outline-variant mt-1">{new Date(adj.created_at).toLocaleString()}</p>
                                        </div>
                                        <span className="text-sm font-bold text-outline-variant truncate max-w-[100px] shrink-0">{adj.user_name}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Adjust bottom sheet modal ── */}
            {modalOpen && (
                // ✅ CÓDIGO CORREGIDO PARA MEJORAR EN PC
                <div
                    className="fixed inset-0 bg-black/60 z-[60] flex items-end md:items-center md:justify-center backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
                    aria-modal="true"
                    role="dialog"
                >
                    <div className="w-full md:w-[500px] bg-white rounded-t-[32px] md:rounded-[32px] shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="w-16 h-2 bg-outline-variant/50 rounded-full mx-auto mt-4 mb-4" />

                        <div className="px-6 pb-4 border-b border-outline-variant/30 flex justify-between items-start">
                            <div>
                                <h3 className="text-2xl font-black text-on-surface">
                                    {adjustForm.type === 'IN' ? 'Sumar piezas' : 'Restar piezas'}
                                </h3>
                                <p className="text-base text-on-surface-variant font-medium mt-1">
                                    {product.name}
                                </p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 pb-28 md:pb-12 flex flex-col gap-6">                            {error && (
                            <div className="p-4 bg-error-container rounded-xl flex items-center gap-2" aria-live="polite">
                                <span className="material-symbols-outlined text-error text-[24px]">error</span>
                                <p className="text-error font-bold text-base">{error}</p>
                            </div>
                        )}

                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="text-base font-bold text-on-surface-variant mb-2 block">
                                        Operación
                                    </label>
                                    <div className={`w-full px-4 py-4 rounded-xl text-lg font-black flex items-center justify-center gap-2 border-2 ${adjustForm.type === 'IN' ? 'bg-tertiary-container/30 border-tertiary text-tertiary' : 'bg-error-container/30 border-error text-error'
                                        }`}>
                                        <span className="material-symbols-outlined">
                                            {adjustForm.type === 'IN' ? 'add_circle' : 'remove_circle'}
                                        </span>
                                        {adjustForm.type === 'IN' ? 'ENTRADA (+)' : 'SALIDA (−)'}
                                    </div>
                                </div>

                                <div className="flex-1">
                                    <label htmlFor="adjust-quantity" className="text-base font-bold text-on-surface-variant mb-2 block">
                                        ¿Cuántas piezas?
                                    </label>
                                    <input
                                        id="adjust-quantity"
                                        type="number"
                                        min="1"
                                        placeholder="Ej: 5"
                                        value={adjustForm.quantity}
                                        onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                                        className="w-full px-4 py-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-2xl font-black text-center focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/20 transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label htmlFor="adjust-reason" className="text-base font-bold text-on-surface-variant mb-2 block">
                                    Motivo del movimiento
                                </label>
                                <select
                                    id="adjust-reason"
                                    value={adjustForm.reason}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    className="w-full px-4 py-4 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-lg font-bold focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/20 transition-all appearance-none"
                                >
                                    {adjustForm.type === 'IN' ? (
                                        <>
                                            <option value="ingreso de mercancia">Nos llegó mercancía nueva</option>
                                            <option value="devolucion">Un cliente devolvió producto</option>
                                            <option value="auditoria">Apareció en inventario (Auditoría)</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="merma">El producto se echó a perder o rompió (Merma)</option>
                                            <option value="robo">Robo o extravío</option>
                                            <option value="auditoria">Faltó en el inventario (Auditoría)</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            <button
                                onClick={handleAdjustSubmit}
                                className="w-full py-5 bg-secondary text-on-secondary rounded-xl text-xl font-black hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg transition-all mt-2"
                            >
                                Confirmar y Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}