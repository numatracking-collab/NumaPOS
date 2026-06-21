import { useState, useEffect, useRef } from 'react';
import { inventoryService } from '../../services/api';
import ConfirmDeleteModal from './ConfirmDeleteModal';

export default function InventoryDetailPanel({ product, onStockAdjusted, onBack, onEdit, onDelete }) {
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [adjustForm, setAdjustForm] = useState({ type: 'IN', quantity: '', reason: 'ingreso de mercancia' });
    const [error, setError] = useState('');
    const menuRef = useRef(null);

    useEffect(() => {
        if (product) {
            loadAdjustments(product.id);
            setAdjustForm({ type: 'IN', quantity: '', reason: 'ingreso de mercancia' });
            setError('');
            setHistoryOpen(false);
            setMenuOpen(false);
            setDeleteModalOpen(false);
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
        const parsed = parseFloat(adjustForm.quantity);
        if (!adjustForm.quantity || isNaN(parsed) || parsed <= 0) {
            setError('Por favor, ingresa una cantidad válida que sea mayor a cero (0).');
            return;
        }
        if (!allowFractions && !Number.isInteger(parsed)) {
            setError('Este producto no permite cantidades fraccionadas. Ingresa un número entero.');
            return;
        }
        try {
            const data = await inventoryService.createAdjustment({
                product_id: product.id,
                type: adjustForm.type,
                quantity: parsed,
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

    // ── Eliminar producto ───────────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        await onDelete(product); // si lanza error, ConfirmDeleteModal lo muestra y no cierra
        setDeleteModalOpen(false);
        if (onBack) onBack(); // el producto ya no existe: regresamos a la lista en móvil
    };

    // ── Derivados del producto ──────────────────────────────────────────────
    const stock          = product?.stock          ?? 0;
    const min            = product?.min_stock      ?? null;
    const max            = product?.max_stock      ?? null;
    const unit           = product?.unit           || 'pza.';
    const allowFractions = product?.allow_fractions ?? false;
    const isLowStock     = min !== null ? stock < min  : stock <= 5;
    const isOverStock    = max !== null && stock > max;

    // Formato del stock: decimales limpios si es fraccionable, entero si no
    const stockDisplay = allowFractions
        ? Number(stock).toFixed(3).replace(/\.?0+$/, '')
        : Math.floor(stock);

    // Manejo del input de cantidad en el modal
    const handleQtyKeyDown = (e) => {
        if (e.key === 'Enter') e.target.blur();
        const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'];
        if (!allowed.includes(e.key) && !/^\d$/.test(e.key) && e.key !== '.') e.preventDefault();
        if (!allowFractions && e.key === '.') e.preventDefault();
    };

    if (!product) {
        return (
            <section className="hidden md:flex flex-[1.5] flex-col bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.05)] z-20 items-center justify-center p-8 text-center gap-4">
                <span className="material-symbols-outlined text-[64px] text-outline-variant">inventory_2</span>
                <p className="text-on-surface-variant text-base font-medium leading-relaxed max-w-[280px]">
                    Selecciona un producto de la lista para ver sus detalles completos y ajustar su inventario.
                </p>
            </section>
        );
    }

    return (
        <section className={`
            flex flex-col bg-white shadow-[-4px_0_12px_rgba(0,0,0,0.05)]
            fixed inset-0 z-50 w-full h-full
            md:relative md:inset-auto md:z-20 md:flex-[1.5] md:border-l md:border-outline-variant/30
        `}>

            {/* ── Image hero ── */}
            <div className="relative h-44 md:h-52 bg-surface-container-low flex-shrink-0">

                <div className="absolute inset-0 overflow-hidden flex items-center justify-center">
                    {product.images?.[0]?.url || product.image_url ? (
                        <img
                            src={product.images?.[0]?.url || product.image_url}
                            alt={`Fotografía de ${product.name}`}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-2 text-outline mt-6">
                            <span className="material-symbols-outlined text-[52px]">inventory_2</span>
                            <span className="text-sm font-medium">Sin fotografía</span>
                        </div>
                    )}
                </div>

                {/* Badge fraccionable sobre la imagen */}
                {allowFractions && (
                    <div className="absolute bottom-3 left-3 z-10">
                        <span className="flex items-center gap-1 bg-black/55 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full leading-none tracking-wide">
                            <span className="material-symbols-outlined text-[11px]">scatter_plot</span>
                            Venta fraccionada
                        </span>
                    </div>
                )}

                {/* Botón Regresar — solo móvil */}
                {onBack && (
                    <div className="absolute top-3 left-3 z-20 md:hidden">
                        <button
                            onClick={onBack}
                            className="h-11 px-4 rounded-full bg-white/95 border-2 border-outline-variant/40 flex items-center justify-center gap-2 hover:bg-white transition-colors shadow-lg text-on-surface"
                            aria-label="Regresar a la lista"
                        >
                            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
                            <span className="text-sm font-bold">Regresar</span>
                        </button>
                    </div>
                )}

                {/* ── Acciones siempre visibles: Eliminar / Editar / Ajustes de inventario ── */}
                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                    {onDelete && (
                        <button
                            onClick={() => setDeleteModalOpen(true)}
                            className="w-11 h-11 rounded-full bg-white/95 border-2 border-outline-variant/40 flex items-center justify-center hover:bg-white transition-colors shadow-md"
                            aria-label="Eliminar producto"
                        >
                            <span className="material-symbols-outlined text-[22px] text-error">delete</span>
                        </button>
                    )}

                    {onEdit && (
                        <button
                            onClick={() => onEdit(product)}
                            className="w-11 h-11 rounded-full bg-white/95 border-2 border-outline-variant/40 flex items-center justify-center hover:bg-white transition-colors shadow-md"
                            aria-label="Editar producto"
                        >
                            <span className="material-symbols-outlined text-[22px] text-secondary">edit</span>
                        </button>
                    )}

                    {/* 3-dot menu — ajustes de inventario */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setMenuOpen((v) => !v)}
                            className="w-11 h-11 rounded-full bg-white/95 border-2 border-outline-variant/40 flex items-center justify-center hover:bg-white transition-colors shadow-md"
                            aria-label="Abrir opciones de ajuste de inventario"
                            aria-expanded={menuOpen}
                        >
                            <span className="material-symbols-outlined text-[24px] text-on-surface">more_vert</span>
                        </button>

                        {menuOpen && (
                            <div className="absolute right-0 top-12 w-64 max-w-[calc(100vw-24px)] bg-white border-2 border-outline-variant/40 rounded-xl shadow-2xl z-30 overflow-hidden py-1">
                                <p className="px-4 pt-2.5 pb-2 text-xs font-bold text-outline uppercase tracking-widest border-b border-outline-variant/30">
                                    Ajuste de inventario
                                </p>
                                <button
                                    onClick={() => openAdjustModal('IN')}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-base font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left"
                                >
                                    <span className="material-symbols-outlined text-[22px] text-tertiary">add_circle</span>
                                    Registrar entrada (+)
                                </button>
                                <button
                                    onClick={() => openAdjustModal('OUT')}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-base font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left border-t border-outline-variant/20"
                                >
                                    <span className="material-symbols-outlined text-[22px] text-error">remove_circle</span>
                                    Registrar salida (−)
                                </button>
                                <button
                                    onClick={() => openAdjustModal('IN')}
                                    className="w-full flex items-center gap-3 px-4 py-3.5 text-base font-medium text-on-surface hover:bg-surface-container-low transition-colors text-left border-t border-outline-variant/20"
                                >
                                    <span className="material-symbols-outlined text-[22px] text-secondary">tune</span>
                                    Corrección de error
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Área de contenido desplazable */}
            <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar pb-6 md:pb-0">

                {/* ── Información del producto ── */}
                <div className="px-4 py-4 border-b border-outline-variant/30 flex-shrink-0 flex flex-col gap-3">
                    <div>
                        <h2 className="font-black text-xl md:text-2xl text-on-surface leading-tight mb-2">
                            {product.name}
                        </h2>

                        <div className="flex flex-wrap items-center gap-2">
                            {product.department && (
                                <span className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-md bg-secondary-container text-on-secondary-container">
                                    <span className="material-symbols-outlined text-[16px]">storefront</span>
                                    {product.department}
                                </span>
                            )}
                            <span className="font-mono text-sm font-bold text-on-surface-variant bg-surface-container px-2.5 py-1.5 rounded-md">
                                Código: {product.sku || 'Sin código'}
                            </span>
                            {/* Chip de unidad */}
                            <span className="inline-flex items-center gap-1 text-sm font-bold px-2.5 py-1.5 rounded-md bg-surface-container text-on-surface-variant">
                                <span className="material-symbols-outlined text-[14px]">straighten</span>
                                {unit}
                            </span>
                        </div>
                    </div>

                    {/* Tarjeta de Precios */}
                    <div className="flex flex-col sm:grid sm:grid-cols-2 gap-3 bg-surface-container-lowest border-2 border-outline-variant/30 rounded-xl p-4">
                        <div className="border-b-2 sm:border-b-0 sm:border-r-2 border-outline-variant/30 pb-3 sm:pb-0 sm:pr-4">
                            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wide mb-1">Costo al proveedor</p>
                            <p className="text-lg font-bold text-on-surface">
                                ${Number(product.cost ?? 0).toFixed(2)}
                                <span className="text-xs font-semibold text-outline ml-1">/ {unit}</span>
                            </p>
                        </div>
                        <div className="sm:pl-2">
                            <p className="text-xs font-bold text-secondary uppercase tracking-wide mb-1">Precio al público</p>
                            <p className="text-xl font-black text-secondary">
                                ${Number(product.price ?? 0).toFixed(2)}
                                <span className="text-xs font-semibold text-secondary/60 ml-1">/ {unit}</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Conteo de stock ── */}
                <div className="px-4 py-4 flex items-center justify-between border-b border-outline-variant/30 bg-surface flex-shrink-0">
                    <div className="flex items-center gap-2.5 text-base font-bold text-on-surface-variant">
                        <span className="material-symbols-outlined text-[26px]">package_2</span>
                        <span className="hidden sm:inline">Existencia en tienda:</span>
                        <span className="sm:hidden">Existencia:</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-[38px] font-black text-on-surface leading-none">{stockDisplay}</span>
                        <span className="text-sm font-bold text-outline">{unit}</span>
                    </div>
                </div>

                {/* ── Límites Mín / Máx ── */}
                {(min !== null || max !== null) && (
                    <div className="grid grid-cols-2 divide-x-2 divide-outline-variant/30 border-b border-outline-variant/30 flex-shrink-0 bg-surface-container-low">
                        <div className="px-4 py-3.5 flex flex-col gap-1">
                            <span className="text-xs font-bold text-outline-variant uppercase tracking-wider flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
                                Mínimo permitido
                            </span>
                            <span className="text-xl font-black text-on-surface">
                                {min !== null ? `${min} ${unit}` : 'No asignado'}
                            </span>
                        </div>
                        <div className="px-4 py-3.5 flex flex-col gap-1">
                            <span className="text-xs font-bold text-outline-variant uppercase tracking-wider flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
                                Máximo permitido
                            </span>
                            <span className="text-xl font-black text-on-surface">
                                {max !== null ? `${max} ${unit}` : 'No asignado'}
                            </span>
                        </div>
                    </div>
                )}

                {/* ── Alertas de stock ── */}
                {isLowStock && (
                    <div className="mx-4 my-3 px-4 py-3.5 rounded-xl bg-error-container flex items-start gap-3 flex-shrink-0 border border-error/20">
                        <span className="material-symbols-outlined text-[22px] text-error mt-0.5">warning</span>
                        <p className="text-sm font-bold text-on-error-container leading-snug">
                            ¡Atención! Hay muy {allowFractions ? 'poco' : 'pocas'} {unit} de este producto. Se recomienda surtir pronto.
                        </p>
                    </div>
                )}
                {isOverStock && (
                    <div className="mx-4 my-3 px-4 py-3.5 rounded-xl bg-primary-container flex items-start gap-3 flex-shrink-0 border border-primary/20">
                        <span className="material-symbols-outlined text-[22px] text-primary mt-0.5">info</span>
                        <p className="text-sm font-bold text-on-primary-container leading-snug">
                            ¡Aviso! Tienes más {unit} de los recomendados ocupando espacio.
                        </p>
                    </div>
                )}

                {/* ── Historial de cambios ── */}
                <div className="flex-shrink-0">
                    <button
                        onClick={() => setHistoryOpen((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-4 border-y border-outline-variant/30 hover:bg-surface-container-low transition-colors"
                        aria-expanded={historyOpen}
                    >
                        <div className="flex items-center gap-2.5 text-base font-bold text-on-surface">
                            <span className="material-symbols-outlined text-[22px] text-on-surface-variant">history</span>
                            Historial de cambios
                            {adjustments.length > 0 && (
                                <span className="text-xs bg-secondary-container text-on-secondary-container font-black px-2.5 py-1 rounded-full">
                                    {adjustments.length}
                                </span>
                            )}
                        </div>
                        <span
                            className="material-symbols-outlined text-[26px] text-outline transition-transform duration-200"
                            style={{ transform: historyOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                        >
                            expand_more
                        </span>
                    </button>

                    {historyOpen && (
                        <div>
                            {loading ? (
                                <div className="text-center text-on-surface-variant py-8 text-sm font-medium">
                                    Cargando historial…
                                </div>
                            ) : adjustments.length === 0 ? (
                                <div className="text-center text-outline-variant py-8 text-sm font-medium">
                                    Aún no hay cambios registrados en este producto.
                                </div>
                            ) : (
                                adjustments.map((adj) => {
                                    // Mostrar cantidad con decimales limpios si el producto es fraccionable
                                    const qtyDisplay = allowFractions
                                        ? Number(adj.quantity).toFixed(3).replace(/\.?0+$/, '')
                                        : adj.quantity;
                                    return (
                                        <div
                                            key={adj.id}
                                            className="flex items-center gap-3 px-4 py-3.5 border-b border-outline-variant/20 last:border-none"
                                        >
                                            <span className={`text-sm font-black px-2.5 py-1.5 rounded-lg shrink-0 min-w-[56px] text-center ${
                                                adj.type === 'IN'
                                                    ? 'bg-tertiary-container text-tertiary-dark'
                                                    : 'bg-error-container text-error-dark'
                                            }`}>
                                                {adj.type === 'IN' ? '+' : '−'}{qtyDisplay}
                                                <span className="text-[9px] font-semibold ml-0.5 opacity-70">{unit}</span>
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-on-surface capitalize truncate">{adj.reason}</p>
                                                <p className="text-xs font-medium text-outline-variant mt-0.5">
                                                    {new Date(adj.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <span className="text-xs font-bold text-outline-variant truncate max-w-[80px] shrink-0">
                                                {adj.user_name}
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Modal de ajuste de inventario ── */}
            {modalOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-[60] flex items-end md:items-center md:justify-center backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
                    aria-modal="true"
                    role="dialog"
                >
                    <div className="w-full md:w-[480px] bg-white rounded-t-[28px] md:rounded-[28px] shadow-2xl max-h-[90vh] overflow-y-auto">
                        <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mt-4 mb-3" />

                        <div className="px-5 pb-4 border-b border-outline-variant/30 flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-black text-on-surface">
                                    {adjustForm.type === 'IN' ? 'Registrar entrada' : 'Registrar salida'}
                                </h3>
                                <p className="text-sm text-on-surface-variant font-medium mt-0.5">
                                    {product.name}
                                </p>
                                {allowFractions && (
                                    <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-bold text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                                        <span className="material-symbols-outlined text-[11px]">scatter_plot</span>
                                        Permite fracciones · {unit}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant"
                                aria-label="Cerrar"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-5 pb-24 md:pb-10 flex flex-col gap-5">
                            {error && (
                                <div className="p-3.5 bg-error-container rounded-xl flex items-center gap-2" aria-live="polite">
                                    <span className="material-symbols-outlined text-error text-[20px]">error</span>
                                    <p className="text-error font-bold text-sm">{error}</p>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Tipo de operación (solo lectura) */}
                                <div className="flex-1">
                                    <label className="text-sm font-bold text-on-surface-variant mb-2 block">
                                        Operación
                                    </label>
                                    <div className={`w-full px-4 py-3.5 rounded-xl text-base font-black flex items-center justify-center gap-2 border-2 ${
                                        adjustForm.type === 'IN'
                                            ? 'bg-tertiary-container/30 border-tertiary text-tertiary'
                                            : 'bg-error-container/30 border-error text-error'
                                    }`}>
                                        <span className="material-symbols-outlined">
                                            {adjustForm.type === 'IN' ? 'add_circle' : 'remove_circle'}
                                        </span>
                                        {adjustForm.type === 'IN' ? 'ENTRADA (+)' : 'SALIDA (−)'}
                                    </div>
                                </div>

                                {/* Input de cantidad */}
                                <div className="flex-1">
                                    <label htmlFor="adjust-quantity" className="text-sm font-bold text-on-surface-variant mb-2 block">
                                        ¿Cuánto{allowFractions ? 's' : 's'}? <span className="font-normal text-outline">({unit})</span>
                                    </label>
                                    <input
                                        id="adjust-quantity"
                                        type="text"
                                        inputMode={allowFractions ? 'decimal' : 'numeric'}
                                        placeholder={allowFractions ? 'Ej: 1.5' : 'Ej: 5'}
                                        value={adjustForm.quantity}
                                        onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                                        onKeyDown={handleQtyKeyDown}
                                        onFocus={(e) => e.target.select()}
                                        className="w-full px-4 py-3.5 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-2xl font-black text-center focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/20 transition-all"
                                    />
                                    {allowFractions && (
                                        <p className="text-[11px] text-on-surface-variant/70 mt-1.5 text-center">
                                            Puedes ingresar decimales: 0.5, 1.25, 2.75…
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label htmlFor="adjust-reason" className="text-sm font-bold text-on-surface-variant mb-2 block">
                                    Motivo del movimiento
                                </label>
                                <select
                                    id="adjust-reason"
                                    value={adjustForm.reason}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    className="w-full px-4 py-3.5 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-base font-bold focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/20 transition-all appearance-none"
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
                                className="w-full py-4 bg-secondary text-on-secondary rounded-xl text-lg font-black hover:bg-secondary/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg transition-all mt-1"
                            >
                                Confirmar y Guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal de confirmación de eliminación ── */}
            <ConfirmDeleteModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                title="¿Eliminar producto?"
                itemName={product.name}
                description={`¿Seguro que quieres eliminar "${product.name}"? Esta acción no se puede deshacer y se perderá su historial de inventario.`}
            />
        </section>
    );
}