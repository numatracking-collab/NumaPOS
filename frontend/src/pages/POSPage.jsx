import { useState, useEffect } from 'react';
import TopAppBar from '../components/TopAppBar';
import CategoryTabs from '../components/CategoryTabs';
import ProductCard from '../components/ProductCard';
import TicketSidebar from '../components/TicketSidebar';
import BottomNav from '../components/BottomNav';
import { productService } from '../services/api';

const LS_CART = 'numa_pos_cart';

export default function POSPage() {
    const [activeCategory, setActiveCategory] = useState(null);
    const [products,       setProducts]       = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [showToast,      setShowToast]      = useState(false);
    const [selectedCaja,   setSelectedCaja]   = useState(null);
    const [selectedSerie,  setSelectedSerie]  = useState(null);
    const [mobileView,     setMobileView]     = useState('products');

    const [cart, setCart] = useState(() => {
        try {
            const stored = localStorage.getItem(LS_CART);
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });

    useEffect(() => {
        try { localStorage.setItem(LS_CART, JSON.stringify(cart)); } catch {}
    }, [cart]);

    useEffect(() => { loadProducts(); }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const data = await productService.getAll();
            setProducts(data);
        } catch (error) {
            console.error('Error al cargar los productos:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = activeCategory
        ? products.filter(p => p.category_id === activeCategory)
        : products;

    const handleAddProduct = (product) => {
        setCart((prev) => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...product, quantity: 1 }];
        });
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
    };

    const handleUpdateQuantity = (id, amount) => {
        setCart((prev) =>
            prev.map(item => {
                if (item.id !== id) return item;
                const newQty = item.quantity + amount;
                return newQty > 0 ? { ...item, quantity: newQty } : null;
            }).filter(Boolean)
        );
    };

    const handleClearCart = () => {
        setCart([]);
        try { localStorage.removeItem(LS_CART); } catch {}
    };

    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

    // Altura de las pestañas en móvil — espacio que deben respetar las vistas
    const TAB_H = 40; // px

    return (
        // ── La clave: h-screen con flex column, cada hijo shrink-0 excepto main
        <div className="h-screen flex flex-col overflow-hidden bg-background">

            <TopAppBar
                onCajaChange={setSelectedCaja}
                onSeriesChange={setSelectedSerie}
                mobileView={mobileView}
            />

            {/* ══════════════════════════════════════════════════════════════
                DESKTOP — layout original intacto
            ══════════════════════════════════════════════════════════════ */}
            <main className="hidden md:flex flex-1 overflow-hidden w-full bg-background">
                <CategoryTabs activeCategory={activeCategory} setActiveCategory={setActiveCategory} />

                <section className="flex-[3] flex flex-col border-r border-outline-variant bg-slate-50">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[48px] animate-spin">refresh</span>
                            <span className="text-xl font-bold">Cargando catálogo...</span>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-md grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md custom-scrollbar bg-slate-50">
                            {filteredProducts.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center text-on-surface-variant py-12 gap-4">
                                    <span className="material-symbols-outlined text-[64px] text-outline-variant">inventory_2</span>
                                    <p className="text-xl font-bold text-center">No hay productos en esta categoría.</p>
                                </div>
                            ) : (
                                filteredProducts.map(product => (
                                    <ProductCard key={product.id} product={product} onAdd={handleAddProduct} />
                                ))
                            )}
                        </div>
                    )}
                </section>

                <TicketSidebar
                    cart={cart}
                    products={products}
                    onUpdateQuantity={handleUpdateQuantity}
                    onClearCart={handleClearCart}
                    onSaleSuccess={loadProducts}
                    onAddProduct={handleAddProduct}
                    cajaId={selectedCaja?.id ?? null}
                    serie={selectedSerie}
                />
            </main>

            {/* ══════════════════════════════════════════════════════════════
                MÓVIL — flex column: [pestañas fijas arriba] + [contenido]
                Las pestañas están ARRIBA del contenido en el flujo normal,
                así nunca se enciman.
            ══════════════════════════════════════════════════════════════ */}
            <div className="md:hidden flex-1 flex flex-col overflow-hidden min-h-0">

                {/* ── Pestañas tipo carpeta — SIEMPRE VISIBLES, en el flujo ── */}
                <div className="flex items-end shrink-0 bg-slate-200 border-b-2 border-secondary/20 px-4 pt-1 z-30">
                    {/* Pestaña Productos */}
                    <button
                        onClick={() => setMobileView('products')}
                        className={`
                            relative flex items-center gap-1.5
                            px-5 pt-2 pb-2.5 rounded-t-xl font-bold text-[12px]
                            transition-all duration-200
                            ${mobileView === 'products'
                                ? 'bg-slate-50 text-secondary shadow-sm z-20'
                                : 'bg-slate-300 text-slate-500 z-10 translate-y-0.5 opacity-75'
                            }
                        `}
                        style={{ marginRight: '-2px', clipPath: 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 100%, 0% 100%)' }}
                    >
                        <span className="material-symbols-outlined text-[15px]"
                            style={{ fontVariationSettings: mobileView === 'products' ? "'FILL' 1" : "'FILL' 0" }}>
                            grid_view
                        </span>
                        Productos
                    </button>

                    {/* Pestaña Ticket */}
                    <button
                        onClick={() => setMobileView('ticket')}
                        className={`
                            relative flex items-center gap-1.5
                            px-5 pt-2 pb-2.5 rounded-t-xl font-bold text-[12px]
                            transition-all duration-200
                            ${mobileView === 'ticket'
                                ? 'bg-white text-secondary shadow-sm z-20'
                                : 'bg-slate-300 text-slate-500 z-10 translate-y-0.5 opacity-75'
                            }
                        `}
                        style={{ marginLeft: '-2px', clipPath: 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 100%, 0% 100%)' }}
                    >
                        <span className="material-symbols-outlined text-[15px]"
                            style={{ fontVariationSettings: mobileView === 'ticket' ? "'FILL' 1" : "'FILL' 0" }}>
                            receipt_long
                        </span>
                        Ticket
                        {cartCount > 0 && (
                            <span className="absolute -top-1.5 -right-1 w-4 h-4 rounded-full bg-secondary text-white text-[9px] font-black flex items-center justify-center shadow-sm">
                                {cartCount > 9 ? '9+' : cartCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* ── Contenido de la vista activa — ocupa el resto del espacio ── */}
                <div className="flex-1 overflow-hidden relative min-h-0">

                    {/* Vista Productos */}
                    <div className={`absolute inset-0 flex transition-transform duration-300 ease-in-out ${
                        mobileView === 'products' ? 'translate-x-0' : '-translate-x-full'
                    }`}>
                        <CategoryTabs
                            activeCategory={activeCategory}
                            setActiveCategory={setActiveCategory}
                            mobile
                        />
                        <section className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
                            {loading ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
                                    <span className="material-symbols-outlined text-[48px] animate-spin">refresh</span>
                                    <span className="text-xl font-bold">Cargando...</span>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-2 custom-scrollbar">
                                    {filteredProducts.length === 0 ? (
                                        <div className="col-span-full flex flex-col items-center justify-center text-on-surface-variant py-12 gap-4">
                                            <span className="material-symbols-outlined text-[64px] text-outline-variant">inventory_2</span>
                                            <p className="text-lg font-bold text-center">No hay productos aquí.</p>
                                        </div>
                                    ) : (
                                        filteredProducts.map(product => (
                                            <ProductCard
                                                key={product.id}
                                                product={product}
                                                onAdd={handleAddProduct}
                                            />
                                        ))
                                    )}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* Vista Ticket */}
                    <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${
                        mobileView === 'ticket' ? 'translate-x-0' : 'translate-x-full'
                    }`}>
                        <TicketSidebar
                            cart={cart}
                            products={products}
                            onUpdateQuantity={handleUpdateQuantity}
                            onClearCart={handleClearCart}
                            onSaleSuccess={loadProducts}
                            onAddProduct={handleAddProduct}
                            cajaId={selectedCaja?.id ?? null}
                            serie={selectedSerie}
                        />
                    </div>
                </div>
            </div>

            {/* BottomNav — siempre en el flujo, nunca tapado */}
            <BottomNav />

            {/* Toast */}
            <div className={`
                fixed bg-secondary text-white px-lg py-sm rounded-full shadow-xl
                transition-all duration-300 z-[60] flex items-center gap-md
                bottom-[88px] left-1/2 -translate-x-1/2
                md:bottom-24 md:right-[420px] md:left-auto md:translate-x-0
                ${showToast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
            `}>
                <span className="material-symbols-outlined">check_circle</span>
                <span className="font-label-bold text-label-bold">Producto agregado</span>
            </div>
        </div>
    );
}