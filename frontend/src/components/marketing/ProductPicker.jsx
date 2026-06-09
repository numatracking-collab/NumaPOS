/* ═══════════════════════════════════════════════════════════════════════════
   ProductPicker.jsx — Selector de productos para ofertas
   • Carga categorías desde categoryService.getAll()
   • Carga productos desde inventoryService.getAll() con filtro por categoría
   • Muestra ProductCard con imagen y stock
   • Chips de categorías en la parte superior
   • Búsqueda por nombre o SKU
   • Selección múltiple con tick visual
═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import { categoryService, inventoryService } from '../../services/api';

/* ── Mini ProductCard adaptada para el picker ───────────────────────── */
function PickerProductCard({ product, selected, onToggle }) {
    const mainImage = product.images?.[0]?.url || product.image_url || null;

    const isLow  = product.stock <= (product.min_stock ?? 5);
    const isOver = product.max_stock && product.stock >= product.max_stock;

    const stockColor = isLow
        ? 'bg-error-container text-error'
        : isOver
            ? 'bg-orange-100 text-orange-700'
            : 'bg-tertiary-fixed text-on-tertiary-fixed-variant';

    const stockLabel = isLow ? 'BAJO STOCK' : isOver ? 'SOBRE STOCK' : `${product.stock} u.`;

    return (
        <div
            onClick={onToggle}
            role="checkbox"
            aria-checked={selected}
            tabIndex={0}
            onKeyDown={e => (e.key === ' ' || e.key === 'Enter') && onToggle()}
            className={`
                relative flex flex-col rounded-xl overflow-hidden cursor-pointer
                border-2 transition-all active:scale-[0.97] select-none
                ${selected
                    ? 'border-secondary shadow-md shadow-secondary/20'
                    : 'border-outline-variant hover:border-secondary/40 hover:shadow-sm'}
                bg-white
            `}
        >
            {/* ── Tick de selección ── */}
            <div className={`
                absolute top-2 right-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center
                transition-all
                ${selected
                    ? 'bg-secondary border-secondary'
                    : 'bg-white/80 border-outline-variant backdrop-blur-sm'}
            `}>
                {selected && (
                    <span className="material-symbols-outlined text-[14px] text-on-secondary font-bold">
                        check
                    </span>
                )}
            </div>

            {/* ── Imagen ── */}
            {mainImage ? (
                <img
                    src={mainImage}
                    alt={product.name}
                    className="h-[80px] w-full object-cover shrink-0"
                    loading="lazy"
                />
            ) : (
                <div className="h-[80px] w-full bg-surface-container-low flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[28px] text-outline-variant" aria-hidden="true">
                        image
                    </span>
                </div>
            )}

            {/* ── Info ── */}
            <div className="p-2 flex flex-col gap-1 flex-1">
                <p className="text-[12px] font-semibold text-on-surface line-clamp-2 leading-tight">
                    {product.name}
                </p>
                <div className="flex items-end justify-between gap-1 mt-auto">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wide ${stockColor}`}>
                        {isLow && (
                            <span className="material-symbols-outlined text-[9px] mr-0.5 align-middle">
                                warning
                            </span>
                        )}
                        {stockLabel}
                    </span>
                    <span className="text-[13px] font-black text-secondary leading-none">
                        ${Number(product.price).toFixed(2)}
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ── Chip de categoría ──────────────────────────────────────────────── */
function CategoryChip({ label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`
                shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold
                border transition-all whitespace-nowrap
                ${active
                    ? 'bg-secondary text-on-secondary border-secondary shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:border-secondary/50 hover:bg-secondary/5'}
            `}
        >
            {label}
        </button>
    );
}

/* ── Componente principal ───────────────────────────────────────────── */
export default function ProductPicker({ selectedProducts, onChange }) {
    const [categories,    setCategories]    = useState([]);
    const [products,      setProducts]      = useState([]);
    const [activeCategory, setActiveCategory] = useState(null); // null = Todos
    const [search,        setSearch]        = useState('');
    const [loadingCats,   setLoadingCats]   = useState(true);
    const [loadingProds,  setLoadingProds]  = useState(true);
    const [error,         setError]         = useState('');

    // ── Cargar categorías una sola vez ───────────────────────────────
    useEffect(() => {
        categoryService.getAll()
            .then(res => setCategories(res.data ?? res ?? []))
            .catch(() => setError('No se pudieron cargar las categorías.'))
            .finally(() => setLoadingCats(false));
    }, []);

    // ── Cargar productos cuando cambia la categoría activa ───────────
    const loadProducts = useCallback(async () => {
        setLoadingProds(true);
        setError('');
        try {
            const params = activeCategory ? { category_id: activeCategory } : {};
            const res    = await inventoryService.getAll(params);
            setProducts(res.data ?? res ?? []);
        } catch {
            setError('No se pudieron cargar los productos.');
        } finally {
            setLoadingProds(false);
        }
    }, [activeCategory]);

    useEffect(() => { loadProducts(); }, [loadProducts]);

    // ── Filtro local por búsqueda ─────────────────────────────────────
    const visible = products.filter(p => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
    });

    const isSelected = (id) => selectedProducts.some(p => p.id === id);

    const toggle = (product) => {
        onChange(
            isSelected(product.id)
                ? selectedProducts.filter(p => p.id !== product.id)
                : [...selectedProducts, product]
        );
    };

    return (
        <div className="flex flex-col gap-3">

            {/* ── Barra de búsqueda ─────────────────────────────────── */}
            <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl focus-within:ring-2 focus-within:ring-secondary/40 focus-within:border-secondary/60 transition-all">
                <span className="material-symbols-outlined text-[16px] text-outline shrink-0" aria-hidden="true">
                    search
                </span>
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nombre o SKU…"
                    className="flex-1 text-[13px] bg-transparent focus:outline-none text-on-surface placeholder:text-on-surface-variant/40"
                />
                {search && (
                    <button
                        onClick={() => setSearch('')}
                        className="shrink-0 text-on-surface-variant hover:text-on-surface transition-colors"
                        aria-label="Limpiar búsqueda"
                    >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                )}
            </div>

            {/* ── Chips de categorías ───────────────────────────────── */}
            {!loadingCats && categories.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar-x"
                     style={{ scrollbarWidth: 'none' }}>
                    <CategoryChip
                        label="Todos"
                        active={activeCategory === null}
                        onClick={() => setActiveCategory(null)}
                    />
                    {categories.map(cat => (
                        <CategoryChip
                            key={cat.id}
                            label={cat.name}
                            active={activeCategory === cat.id}
                            onClick={() => setActiveCategory(
                                activeCategory === cat.id ? null : cat.id
                            )}
                        />
                    ))}
                </div>
            )}

            {/* ── Contador de seleccionados ─────────────────────────── */}
            {selectedProducts.length > 0 && (
                <div className="flex items-center justify-between px-1">
                    <span className="text-[12px] text-on-surface-variant">
                        <span className="font-bold text-secondary">{selectedProducts.length}</span>
                        {' '}
                        {selectedProducts.length === 1 ? 'producto seleccionado' : 'productos seleccionados'}
                    </span>
                    <button
                        onClick={() => onChange([])}
                        className="text-[11px] text-error hover:underline font-medium"
                    >
                        Quitar todos
                    </button>
                </div>
            )}

            {/* ── Error ─────────────────────────────────────────────── */}
            {error && (
                <div className="flex items-center gap-2 text-[12px] text-error bg-error/8 border border-error/20 rounded-xl px-3 py-2">
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">error</span>
                    {error}
                </div>
            )}

            {/* ── Grid de productos ─────────────────────────────────── */}
            <div className="relative">
                {loadingProds ? (
                    /* Skeleton */
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="rounded-xl bg-surface-container-low animate-pulse"
                                style={{ height: 140 }}
                            />
                        ))}
                    </div>
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[40px] text-outline-variant" aria-hidden="true">
                            inventory_2
                        </span>
                        <p className="text-[13px] font-medium">
                            {search
                                ? 'No hay productos que coincidan con la búsqueda'
                                : 'No hay productos en esta categoría'}
                        </p>
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="text-[12px] text-secondary hover:underline"
                            >
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
                        {visible.map(product => (
                            <PickerProductCard
                                key={product.id}
                                product={product}
                                selected={isSelected(product.id)}
                                onToggle={() => toggle(product)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Lista de seleccionados (resumen compacto) ─────────── */}
            {selectedProducts.length > 0 && (
                <div className="border-t border-outline-variant/30 pt-3 flex flex-col gap-1.5">
                    <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide">
                        Productos en esta oferta
                    </p>
                    <div className="flex flex-col gap-1">
                        {selectedProducts.map(p => (
                            <div
                                key={p.id}
                                className="flex items-center gap-2 px-3 py-2 bg-secondary/5 border border-secondary/20 rounded-xl"
                            >
                                {/* Miniatura */}
                                <div className="w-8 h-8 rounded-lg overflow-hidden bg-surface-container-low shrink-0 flex items-center justify-center border border-outline-variant/20">
                                    {p.images?.[0]?.url || p.image_url ? (
                                        <img
                                            src={p.images?.[0]?.url || p.image_url}
                                            alt={p.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="material-symbols-outlined text-[14px] text-outline" aria-hidden="true">
                                            image
                                        </span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-semibold text-on-surface truncate">{p.name}</p>
                                    <p className="text-[10px] text-on-surface-variant font-mono">{p.sku || '—'}</p>
                                </div>
                                <span className="text-[12px] font-bold text-secondary shrink-0">
                                    ${Number(p.price).toFixed(2)}
                                </span>
                                <button
                                    onClick={() => toggle(p)}
                                    aria-label={`Quitar ${p.name} de la oferta`}
                                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}