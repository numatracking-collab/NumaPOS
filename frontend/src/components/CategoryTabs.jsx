import { useState } from 'react';
import { useEffect } from 'react';
import { categoryService } from '../services/api';

export default function CategoryTabs({ activeCategory, setActiveCategory, mobile = false }) {
    const [categories, setCategories] = useState([]);
    const [loading,    setLoading]    = useState(true);
    // móvil: controla si el panel está abierto
    const [open, setOpen] = useState(false);

    useEffect(() => {
        categoryService.getAll()
            .then(data => setCategories(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleSelect = (id) => {
        setActiveCategory(id);
        if (mobile) setOpen(false); // cerrar al seleccionar en móvil
    };

    const activeName = activeCategory
        ? categories.find(c => c.id === activeCategory)?.name ?? 'Categoría'
        : 'Todos';

    const activeColor = activeCategory
        ? categories.find(c => c.id === activeCategory)?.color ?? '#0058be'
        : '#64748b';

    /* ── DESKTOP: barra lateral de pestañas ── */
    if (!mobile) {
        return (
            <div className="w-12 bg-slate-200 border-r border-slate-300 flex flex-col pt-lg gap-sm shrink-0 z-20 shadow-[2px_0_8px_rgba(0,0,0,0.05)] overflow-y-auto no-scrollbar">
                <button
                    onClick={() => setActiveCategory(null)}
                    style={{ backgroundColor: '#64748b' }}
                    className={`h-32 rounded-r-xl text-white font-label-bold shadow-md flex items-center justify-center transition-all duration-200 hover:w-[56px] relative flex-shrink-0 ${
                        !activeCategory ? 'w-[56px] -mr-2 z-20 opacity-100' : 'w-[48px] z-10 opacity-90'
                    }`}
                >
                    <span className="folder-tab tracking-wider">Todos</span>
                </button>

                {!loading && categories.map((cat) => {
                    const isActive = activeCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            style={{ backgroundColor: cat.color || '#0058be' }}
                            className={`h-32 rounded-r-xl text-white font-label-bold shadow-md flex items-center justify-center transition-all duration-200 hover:w-[56px] relative flex-shrink-0 ${
                                isActive ? 'w-[56px] -mr-2 z-20 opacity-100' : 'w-[48px] z-10 opacity-90'
                            }`}
                        >
                            <span className="folder-tab tracking-wider">{cat.name}</span>
                        </button>
                    );
                })}
            </div>
        );
    }

    /* ── MÓVIL: botón pestaña + panel deslizable ── */
    return (
        <>
            {/* Botón pestaña lateral — solo visible cuando está cerrado */}
            {!open && (
                <button
                    onClick={() => setOpen(true)}
                    style={{ backgroundColor: activeColor }}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-30
                               w-7 flex flex-col items-center justify-center
                               py-4 rounded-r-xl shadow-lg text-white
                               transition-all duration-200 active:scale-95"
                    aria-label="Abrir categorías"
                >
                    {/* Nombre vertical */}
                    <span
                        className="text-[10px] font-black tracking-widest leading-none"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
                    >
                        {activeName}
                    </span>
                    <span className="material-symbols-outlined text-[14px] mt-1.5">chevron_right</span>
                </button>
            )}

            {/* Overlay oscuro */}
            {open && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 backdrop-blur-[1px]"
                    onClick={() => setOpen(false)}
                />
            )}

            {/* Panel de categorías */}
            <div className={`
                fixed left-0 top-0 bottom-0 z-50 w-52
                bg-surface-bright border-r border-outline-variant
                shadow-2xl flex flex-col
                transition-transform duration-300 ease-in-out
                ${open ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Header del panel */}
                <div className="flex items-center justify-between px-4 py-4 border-b border-outline-variant bg-surface-container-low shrink-0">
                    <span className="font-bold text-[13px] text-on-surface">Categorías</span>
                    <button
                        onClick={() => setOpen(false)}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                {/* Lista de categorías */}
                <div className="flex-1 overflow-y-auto py-2">

                    {/* Todos */}
                    <button
                        onClick={() => handleSelect(null)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                            !activeCategory
                                ? 'bg-secondary/10 text-secondary font-bold'
                                : 'text-on-surface hover:bg-surface-container-low'
                        }`}
                    >
                        <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: '#64748b' }}
                        />
                        <span className="text-[14px] font-medium">Todos los productos</span>
                        {!activeCategory && (
                            <span className="material-symbols-outlined text-[16px] ml-auto">check</span>
                        )}
                    </button>

                    {/* Categorías dinámicas */}
                    {!loading && categories.map(cat => {
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => handleSelect(cat.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                                    isActive
                                        ? 'bg-secondary/10 text-secondary font-bold'
                                        : 'text-on-surface hover:bg-surface-container-low'
                                }`}
                            >
                                <div
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: cat.color || '#0058be' }}
                                />
                                <span className="text-[14px] font-medium truncate">{cat.name}</span>
                                {isActive && (
                                    <span className="material-symbols-outlined text-[16px] ml-auto">check</span>
                                )}
                            </button>
                        );
                    })}

                    {loading && (
                        <div className="px-4 py-3 text-[13px] text-on-surface-variant">Cargando...</div>
                    )}
                </div>
            </div>
        </>
    );
}