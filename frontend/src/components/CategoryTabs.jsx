import { useState, useEffect } from 'react';
import { categoryService } from '../services/api';

export default function CategoryTabs({ activeCategory, setActiveCategory }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const data = await categoryService.getAll();
            setCategories(data);
        } catch (error) {
            console.error('Error al cargar las categorías:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-12 bg-slate-200 border-r border-slate-300 flex flex-col pt-lg gap-sm shrink-0 z-20 shadow-[2px_0_8px_rgba(0,0,0,0.05)] overflow-y-auto no-scrollbar">
            
            {/* Pestaña: Todos los productos */}
            <button
                onClick={() => setActiveCategory(null)}
                style={{ 
                    transitionProperty: 'width', 
                    backgroundColor: '#64748b' // Color gris neutro para "Todos"
                }}
                className={`h-32 rounded-r-xl text-white font-label-bold shadow-md flex items-center justify-center transition-all duration-200 hover:w-[56px] relative flex-shrink-0 ${
                    !activeCategory ? 'w-[56px] -mr-2 z-20 opacity-100' : 'w-[48px] z-10 opacity-90'
                }`}
            >
                <span className="folder-tab tracking-wider">Todos</span>
            </button>

            {/* Pestañas dinámicas desde la Base de Datos */}
            {!loading && categories.map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                    <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        style={{ 
                            transitionProperty: 'width',
                            backgroundColor: cat.color || '#0058be' // Usa el color que viene de BD o el default
                        }}
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