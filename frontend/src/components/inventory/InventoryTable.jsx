export default function InventoryTable({ products, onSelectProduct, selectedProductId, onEdit, onDelete }) {
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-lg bg-surface">
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/30 overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-container-low text-on-surface-variant text-[13px] font-semibold sticky top-0 z-10 shadow-sm">
                        <tr>
                            <th className="py-md px-md w-1/4">Producto</th>
                            <th className="py-md px-md">SKU</th>
                            <th className="py-md px-md">Categoría</th>
                            <th className="py-md px-md text-right">Precio</th>
                            <th className="py-md px-md text-right">Stock</th>
                            <th className="py-md px-md text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="text-[14px] text-on-surface divide-y divide-outline-variant/30">
                        {products.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="py-xl text-center text-on-surface-variant">
                                    No hay productos. Agrega uno nuevo.
                                </td>
                            </tr>
                        ) : (
                            products.map((product) => {
                                const isSelected = selectedProductId === product.id;
                                const isLowStock = product.stock <= 5;
                                
                                return (
                                    <tr 
                                        key={product.id} 
                                        onClick={() => onSelectProduct(product)}
                                        className={`cursor-pointer transition-colors hover:bg-secondary/5 ${isSelected ? 'bg-secondary/10' : ''}`}
                                    >
                                        <td className="py-sm px-md font-medium">{product.name}</td>
                                        <td className="py-sm px-md text-on-surface-variant font-mono text-[12px]">{product.sku || '--'}</td>
                                        <td className="py-sm px-md">
                                            {product.category_name ? (
                                                <span 
                                                    className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                                                    style={{ backgroundColor: `${product.category_color}20`, color: product.category_color }}
                                                >
                                                    {product.category_name}
                                                </span>
                                            ) : (
                                                <span className="text-outline text-[12px]">Sin categoría</span>
                                            )}
                                        </td>
                                        <td className="py-sm px-md text-right font-medium text-secondary">
                                            ${Number(product.price).toFixed(2)}
                                        </td>
                                        <td className="py-sm px-md text-right">
                                            <span className={`inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded font-bold text-[12px] ${isLowStock ? 'bg-error-container text-on-error-container' : 'bg-surface-container-high text-on-surface'}`}>
                                                {product.stock}
                                            </span>
                                        </td>
                                        <td className="py-sm px-md text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-secondary transition-colors"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onDelete(product); }}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
