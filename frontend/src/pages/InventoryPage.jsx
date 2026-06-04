import { useState, useEffect } from 'react';
import TopAppBar from '../components/TopAppBar';
import BottomNav from '../components/BottomNav';
import ProductCard from '../components/ProductCard';
import InventoryDetailPanel from '../components/inventory/InventoryDetailPanel';
import ProductFormModal from '../components/inventory/ProductFormModal';
import CategoryManagerModal from '../components/inventory/CategoryManagerModal';
import { productService, categoryService } from '../services/api';

export default function InventoryPage() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Modals
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState(null);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [prods, cats] = await Promise.all([
                productService.getAll(),
                categoryService.getAll()
            ]);
            setProducts(prods);
            setCategories(cats);
        } catch (err) {
            console.error('Error loading inventory data', err);
        } finally {
            setLoading(false);
        }
    };

    // Product actions
    const handleSaveProduct = async (productData) => {
        try {
            if (productToEdit) {
                await productService.update(productToEdit.id, productData);
            } else {
                await productService.create(productData);
            }
            setIsProductModalOpen(false);
            loadData();
            if (selectedProduct && productToEdit && selectedProduct.id === productToEdit.id) {
                // Update selected product info if it was edited
                setSelectedProduct(null); // Limpiamos para refrescar la vista
            }
        } catch (err) {
            console.error(err);
            alert('Error al guardar el producto: ' + err.message);
        }
    };

    const handleDeleteProduct = async (product) => {
        if (!confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) return;
        try {
            await productService.delete(product.id);
            if (selectedProduct?.id === product.id) setSelectedProduct(null);
            loadData();
        } catch (err) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    // Filter products
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCategory = categoryFilter ? p.category_id === Number(categoryFilter) : true;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background">
            <TopAppBar 
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                placeholder="Buscar en inventario..."
                hideActions={true}
            />

            <main className="flex-1 flex overflow-hidden w-full bg-background relative">
                
                {/* ── Main Content Area (Oculto en celular si hay un producto seleccionado) ── */}
                <section className={`flex-[3] flex-col relative z-10 ${selectedProduct ? 'hidden md:flex' : 'flex'}`}>
                    
                    {/* ── Toolbar (Adaptado para celular: se apila y usa botones grandes) ── */}
                    <div className="px-5 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface border-b border-outline-variant/30">
                        
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full md:w-auto">
                            <h1 className="text-2xl font-black text-on-surface">Inventario</h1>
                            
                            <select 
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="w-full sm:w-auto px-4 py-3 md:py-2 bg-surface-container-lowest border-2 border-outline-variant rounded-xl text-base font-bold text-on-surface focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all"
                            >
                                <option value="">Todas las categorías</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="flex gap-3 w-full md:w-auto">
                            <button 
                                onClick={() => setIsCategoryModalOpen(true)}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-3 md:py-2 bg-surface-container-high border-2 border-outline-variant/50 text-on-surface font-bold text-base rounded-xl hover:bg-surface-container-highest transition-colors active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[24px]">category</span>
                                <span className="hidden sm:inline">Categorías</span>
                            </button>
                            <button 
                                onClick={() => { setProductToEdit(null); setIsProductModalOpen(true); }}
                                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-3 md:py-2 bg-secondary text-on-secondary font-black text-base rounded-xl hover:bg-secondary/90 transition-colors shadow-md active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[24px]">add_circle</span>
                                Nuevo Producto
                            </button>
                        </div>
                    </div>

                    {/* ── Product Grid (1 columna en celular, 2-4 en pantallas más grandes) ── */}
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-on-surface-variant bg-slate-50">
                            <span className="material-symbols-outlined text-[48px] animate-spin">refresh</span>
                            <span className="text-xl font-bold">Cargando inventario...</span>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 custom-scrollbar bg-slate-50">
                            {filteredProducts.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center text-on-surface-variant py-12 gap-4">
                                    <span className="material-symbols-outlined text-[64px] text-outline-variant">search_off</span>
                                    <p className="text-xl font-bold text-center">No encontramos productos.</p>
                                </div>
                            ) : (
                                filteredProducts.map((product) => (
                                    <ProductCard 
                                        key={product.id} 
                                        product={product} 
                                        onSelect={setSelectedProduct}
                                        onEdit={(p) => { setProductToEdit(p); setIsProductModalOpen(true); }}
                                        onDelete={handleDeleteProduct}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </section>

                {/* ── Detail Panel ── */}
                <InventoryDetailPanel 
                    product={selectedProduct}
                    onStockAdjusted={(newStock) => {
                        // Actualización optimista de la tabla
                        setProducts(products.map(p => p.id === selectedProduct.id ? { ...p, stock: newStock } : p));
                        setSelectedProduct({ ...selectedProduct, stock: newStock });
                    }}
                    // ¡AQUÍ ESTABA EL ERROR! Cambiado a setSelectedProduct
                    onBack={() => setSelectedProduct(null)} 
                />
            </main>

            <BottomNav />

            {/* Modals */}
            <ProductFormModal 
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                onSave={handleSaveProduct}
                product={productToEdit}
                categories={categories}
            />

            <CategoryManagerModal 
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
                onCategoriesUpdated={(cats) => setCategories(cats)}
            />
        </div>
    );
}