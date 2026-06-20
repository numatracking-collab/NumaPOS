import { useState, useEffect } from 'react';
import TopAppBar from '../components/TopAppBar';
import CategoryTabs from '../components/CategoryTabs';
import ProductCard from '../components/ProductCard';
import TicketSidebar from '../components/TicketSidebar';
import BottomNav from '../components/BottomNav';
import { inventoryService as productService, offersService } from '../services/api';

const LS_CART = 'numa_pos_cart';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de oferta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve la primera oferta activa que aplica al producto ahora mismo.
 * Verifica: status, producto incluido, día de la semana, horario y fechas.
 */
function findApplicableOffer(product, offers) {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.toTimeString().slice(0, 5);
    const currentDate = now.toISOString().slice(0, 10);

    return offers.find(offer => {
        if (offer.status !== 'active') return false;
        if (!offer.products?.some(p => p.id === product.id)) return false;
        if (!offer.active_days?.includes(currentDay)) return false;
        if (offer.time_start && currentTime < offer.time_start) return false;
        if (offer.time_end && currentTime > offer.time_end) return false;
        if (offer.date_start && currentDate < offer.date_start) return false;
        if (offer.date_end && currentDate > offer.date_end) return false;
        return true;
    }) ?? null;
}

/**
 * Aplica la oferta al item del carrito.
 *
 * ⚠️  REGLA CLAVE: item.price NUNCA se modifica.
 *     Siempre refleja el precio de catálogo original de la BD.
 *     El descuento real lo calcula effectiveSubtotal() en TicketSidebar.
 *
 * Tipos de cantidad (2x1, 3x2, nxm): ajusta quantity al mínimo que activa
 *   la promo; las unidades "gratis" se descuentan en effectiveSubtotal().
 *
 * Tipos de precio (mitad, descuento): price queda intacto, appliedOffer
 *   almacena los datos necesarios para que effectiveSubtotal() calcule bien.
 */
function applyOfferToCart(cart, productId, offer) {
    return cart.map(item => {
        if (item.id !== productId) return item;
        if (item.appliedOffer?.id === offer.id) return item; // ya aplicada

        switch (offer.type) {
            case '2x1': {
                const newQty = Math.max(2, Math.ceil(item.quantity / 2) * 2);
                return { ...item, quantity: newQty, appliedOffer: offer };
            }
            case '3x2': {
                const newQty = Math.max(3, Math.ceil(item.quantity / 3) * 3);
                return { ...item, quantity: newQty, appliedOffer: offer };
            }
            case 'nxm': {
                const buyQ = offer.buy_qty || 1;
                const getQ = offer.get_qty || 1;
                const cycle = buyQ + getQ;
                const sets = Math.max(1, Math.ceil(item.quantity / buyQ));
                const newQty = sets * cycle;
                return { ...item, quantity: newQty, appliedOffer: offer };
            }
            case 'mitad':
            case 'descuento':
                // Sin cambio de price ni quantity
                return { ...item, appliedOffer: offer };
            default:
                return item;
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// POSPage
// ─────────────────────────────────────────────────────────────────────────────
export default function POSPage() {
    const [activeCategory, setActiveCategory] = useState(null);
    const [products, setProducts] = useState([]);
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showToast, setShowToast] = useState(false);
    const [selectedCaja, setSelectedCaja] = useState(null);
    const [selectedSerie, setSelectedSerie] = useState(null);
    const [mobileView, setMobileView] = useState('products');

    /** Oferta detectada pendiente de confirmación del cajero */
    const [pendingOffer, setPendingOffer] = useState(null);

    const [cart, setCart] = useState(() => {
        try {
            const stored = localStorage.getItem(LS_CART);
            return stored ? JSON.parse(stored) : [];
        } catch { return []; }
    });

    useEffect(() => {
        try { localStorage.setItem(LS_CART, JSON.stringify(cart)); } catch { }
    }, [cart]);

    useEffect(() => { loadProducts(); loadOffers(); }, []);

    const loadProducts = async () => {
        setLoading(true);
        try { setProducts(await productService.getAll()); }
        catch (err) { console.error('Error al cargar productos:', err); }
        finally { setLoading(false); }
    };

    const loadOffers = async () => {
        try {
            const data = await offersService.getAll({ status: 'active' });
            setOffers(Array.isArray(data) ? data : []);
        } catch (err) { console.error('Error al cargar ofertas:', err); }
    };

    const filteredProducts = activeCategory
        ? products.filter(p => p.category_id === activeCategory)
        : products;

    // ── Agregar producto ──────────────────────────────────────────────────────
    const handleAddProduct = (product) => {
        setCart(prev => {
            const existing = prev.find(i => i.id === product.id);
            if (existing) return prev.map(i =>
                i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
            );
            return [...prev, { ...product, quantity: 1 }];
        });

        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);

        // Detectar oferta solo si no hay una pendiente y el producto
        // todavía no tiene una oferta aplicada.
        const alreadyApplied = cart.some(i => i.id === product.id && i.appliedOffer);
        if (!pendingOffer && !alreadyApplied) {
            const match = findApplicableOffer(product, offers);
            if (match) setPendingOffer({ offer: match, productId: product.id, productName: product.name });
        }
    };

    const handleApplyOffer = () => {
        if (!pendingOffer) return;
        setCart(prev => applyOfferToCart(prev, pendingOffer.productId, pendingOffer.offer));
        setPendingOffer(null);
    };

    const handleDismissOffer = () => setPendingOffer(null);

    const handleUpdateQuantity = (id, amount) => {
        setCart(prev =>
            prev.map(item => {
                if (item.id !== id) return item;
                const newQty = item.quantity + amount;
                return newQty > 0 ? { ...item, quantity: newQty } : null;
            }).filter(Boolean)
        );
    };

    const handleClearCart = () => {
        setCart([]);
        setPendingOffer(null);
        try { localStorage.removeItem(LS_CART); } catch { }
    };

    const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

    // DESPUÉS — agregar cajaNombre
    const sidebarProps = {
        cart,
        products,
        onUpdateQuantity: handleUpdateQuantity,
        onClearCart: handleClearCart,
        onSaleSuccess: loadProducts,
        onAddProduct: handleAddProduct,
        cajaId: selectedCaja?.id ?? null,
        cajaNombre: selectedCaja?.name ?? '',  // ← agregar
        serie: selectedSerie,
        pendingOffer,
        onApplyOffer: handleApplyOffer,
        onDismissOffer: handleDismissOffer,
    };
    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background">

            <TopAppBar
                onCajaChange={setSelectedCaja}
                onSeriesChange={setSelectedSerie}
                mobileView={mobileView}
            />

            {/* ── DESKTOP ── */}
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
                                filteredProducts.map(p => <ProductCard key={p.id} product={p} onAdd={handleAddProduct} />)
                            )}
                        </div>
                    )}
                </section>

                <TicketSidebar {...sidebarProps} />
            </main>

            {/* ── MÓVIL ── */}
            <div className="md:hidden flex-1 flex flex-col overflow-hidden min-h-0">

                <div className="flex items-end shrink-0 bg-slate-200 border-b-2 border-secondary/20 px-4 pt-1 z-30">
                    <button
                        onClick={() => setMobileView('products')}
                        className={`relative flex items-center gap-1.5 px-5 pt-2 pb-2.5 rounded-t-xl font-bold text-[12px] transition-all duration-200 ${mobileView === 'products'
                                ? 'bg-slate-50 text-secondary shadow-sm z-20'
                                : 'bg-slate-300 text-slate-500 z-10 translate-y-0.5 opacity-75'}`}
                        style={{ marginRight: '-2px', clipPath: 'polygon(4px 0%, calc(100% - 4px) 0%, 100% 100%, 0% 100%)' }}
                    >
                        <span className="material-symbols-outlined text-[15px]"
                            style={{ fontVariationSettings: mobileView === 'products' ? "'FILL' 1" : "'FILL' 0" }}>
                            grid_view
                        </span>
                        Productos
                    </button>

                    <button
                        onClick={() => setMobileView('ticket')}
                        className={`relative flex items-center gap-1.5 px-5 pt-2 pb-2.5 rounded-t-xl font-bold text-[12px] transition-all duration-200 ${mobileView === 'ticket'
                                ? 'bg-white text-secondary shadow-sm z-20'
                                : 'bg-slate-300 text-slate-500 z-10 translate-y-0.5 opacity-75'}`}
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

                <div className="flex-1 overflow-hidden relative min-h-0">
                    <div className={`absolute inset-0 flex transition-transform duration-300 ease-in-out ${mobileView === 'products' ? 'translate-x-0' : '-translate-x-full'}`}>
                        <CategoryTabs activeCategory={activeCategory} setActiveCategory={setActiveCategory} mobile />
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
                                        filteredProducts.map(p => <ProductCard key={p.id} product={p} onAdd={handleAddProduct} />)
                                    )}
                                </div>
                            )}
                        </section>
                    </div>

                    <div className={`absolute inset-0 transition-transform duration-300 ease-in-out ${mobileView === 'ticket' ? 'translate-x-0' : 'translate-x-full'}`}>
                        <TicketSidebar {...sidebarProps} />
                    </div>
                </div>
            </div>

            <BottomNav />

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