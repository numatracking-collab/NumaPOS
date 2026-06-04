export default function ProductCard({ product, onAdd, onSelect, onEdit, onDelete }) {
    // Definimos mínimos y máximos (Si el producto no los tiene en la BD, usamos valores por defecto lógicos)
    const minStock = product.min_stock !== undefined ? product.min_stock : 5;
    const maxStock = product.max_stock !== undefined ? product.max_stock : Infinity;

    // Evaluamos el estado del stock actual
    const isLowStock = product.stock <= minStock;
    const isOverStock = product.stock >= maxStock && maxStock !== Infinity;

    // Soporta tanto el array nuevo `images` como el campo legacy `image_url`
    const mainImage = product.images?.[0]?.url || product.image_url || null;

    const handleClick = () => {
        if (onAdd) onAdd(product);
        else if (onSelect) onSelect(product);
    };

    // Configuración dinámica de la etiqueta de stock
    let stockLabel = `${product.stock} u.`;
    let stockStyle = "bg-tertiary-fixed text-on-tertiary-fixed-variant";

    if (isLowStock) {
        // Ahora mostramos la alerta + la cantidad exacta
        stockLabel = `BAJO STOCK`;
        stockStyle = "bg-error-container text-error";
    } else if (isOverStock) {
        // Ahora mostramos la alerta + la cantidad exacta
        stockLabel = `SOBRE STOCK`;
        stockStyle = "bg-orange-100 text-orange-700";
    }

    return (
        <div
            onClick={handleClick}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all cursor-pointer flex flex-col h-48 w-full active:scale-[0.98] relative group"
        >
            {/* Acciones editar / eliminar */}
            {(onEdit || onDelete) && (
                <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onEdit && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(product); }}
                            className="w-7 h-7 bg-white/90 backdrop-blur-sm shadow-md rounded-full flex items-center justify-center text-slate-600 hover:text-secondary hover:bg-white transition-colors"
                            title="Editar"
                        >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(product); }}
                            className="w-7 h-7 bg-white/90 backdrop-blur-sm shadow-md rounded-full flex items-center justify-center text-slate-600 hover:text-error hover:bg-white transition-colors"
                            title="Eliminar"
                        >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                    )}
                </div>
            )}

            {/* Imagen principal */}
            {mainImage ? (
                <img
                    className="h-24 w-full object-cover shrink-0"
                    src={mainImage}
                    alt={product.name}
                />
            ) : (
                <div className="h-24 w-full bg-slate-100 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-4xl text-slate-300">photo_camera</span>
                </div>
            )}

          {/* Info */}
            <div className="p-2 flex-1 flex flex-col justify-between gap-1 bg-white relative z-0">
                <h3 className="font-bold text-xs text-on-surface line-clamp-2 leading-tight">
                    {product.name}
                </h3>

                {/* Contenedor principal: Izquierda (Stock/Piezas) y Derecha (Precio) */}
                <div className="flex justify-between items-end mt-1 gap-1">
                    
                    {/* Columna Izquierda: Etiqueta arriba, Piezas abajo */}
                    <div className="flex flex-col gap-1 items-start">
                        <span className={`px-1.5 py-0.5 font-bold text-[8px] rounded flex items-center gap-0.5 whitespace-nowrap tracking-wide ${stockStyle}`}>
                            {isLowStock && <span className="material-symbols-outlined text-[10px]">warning</span>}
                            {isOverStock && <span className="material-symbols-outlined text-[10px]">trending_up</span>}
                            {stockLabel}
                        </span>

                        <span className="text-sm font-bold text-primary leading-none">
                            {/* Si vendes fracciones (ej. 1.5 kg) usa .toFixed(2), si son enteros, déjalo así: */}
                            {product.stock} pza.
                        </span>
                    </div>

                    {/* Columna Derecha: Precio alineado a la parte inferior */}
                    <span className="text-lg font-bold text-secondary leading-none">
                        ${Number(product.price).toFixed(2)}
                    </span>
                    
                </div>
            </div>
        </div>
    );
}