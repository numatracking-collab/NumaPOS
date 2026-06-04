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

    // ── Carrito: se inicializa desde localStorage ─────────────────────────────
    const [cart, setCart] = useState(() => {
        try {
            const stored = localStorage.getItem(LS_CART);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    });

    // ── Persistir carrito en localStorage en cada cambio ─────────────────────
    useEffect(() => {
        try {
            localStorage.setItem(LS_CART, JSON.stringify(cart));
        } catch {}
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
            if (existing) {
                return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
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

    // Limpiar carrito y borrar del localStorage
    const handleClearCart = () => {
        setCart([]);
        try { localStorage.removeItem(LS_CART); } catch {}
    };

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background">

            <TopAppBar
                onCajaChange={setSelectedCaja}
                onSeriesChange={setSelectedSerie}
            />

            <main className="flex-1 flex overflow-hidden w-full bg-background relative">
                <CategoryTabs activeCategory={activeCategory} setActiveCategory={setActiveCategory} />

                <section className="flex-[3] flex flex-col border-r border-outline-variant bg-slate-50 relative z-10">
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

            <BottomNav />

            <div className={`fixed bottom-24 right-[420px] bg-secondary text-white px-lg py-sm rounded-full shadow-xl transition-all duration-300 z-50 flex items-center gap-md ${
                showToast ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
            }`}>
                <span className="material-symbols-outlined">check_circle</span>
                <span className="font-label-bold text-label-bold">Producto agregado al carrito</span>
            </div>
        </div>
    );
}