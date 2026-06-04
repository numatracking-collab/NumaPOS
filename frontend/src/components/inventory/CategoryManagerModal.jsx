import { useState, useEffect } from 'react';
import { categoryService } from '../../services/api';

export default function CategoryManagerModal({ isOpen, onClose, onCategoriesUpdated }) {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [newCategory, setNewCategory] = useState({ name: '', color: '#0058be' });
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', color: '#0058be' });

    useEffect(() => {
        if (isOpen) {
            loadCategories();
        }
    }, [isOpen]);

    const loadCategories = async () => {
        setLoading(true);
        try {
            const data = await categoryService.getAll();
            setCategories(data);
            if (onCategoriesUpdated) onCategoriesUpdated(data);
        } catch (err) {
            setError('Error al cargar las categorías');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newCategory.name) return;
        try {
            await categoryService.create(newCategory);
            setNewCategory({ name: '', color: '#0058be' });
            loadCategories();
        } catch (err) {
            setError(err.message || 'Error al crear');
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editForm.name) return;
        try {
            await categoryService.update(editingId, editForm);
            setEditingId(null);
            loadCategories();
        } catch (err) {
            setError(err.message || 'Error al actualizar');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Seguro que deseas eliminar esta categoría? (Los productos no se eliminarán)')) return;
        try {
            await categoryService.delete(id);
            loadCategories();
        } catch (err) {
            setError(err.message || 'Error al eliminar');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-surface-container-lowest w-full max-w-md min-w-[320px] shrink-0 rounded-2xl shadow-xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
                <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface shrink-0">
                    <h2 className="text-[18px] font-bold text-on-surface">Gestionar Categorías</h2>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-6">
                    {error && <div className="text-error text-[13px] font-medium">{error}</div>}

                    {/* New Category Form */}
                    <form onSubmit={handleCreate} className="flex gap-2 items-end bg-surface-container-low p-4 rounded-xl border border-outline-variant/30">
                        <div className="flex-1 flex flex-col gap-1.5">
                            <label className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wide">Nueva Categoría</label>
                            <input 
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                                placeholder="Ej. Electrónica"
                                className="w-full px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-md text-[14px] focus:outline-none focus:ring-1 focus:ring-secondary"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[12px] font-medium text-on-surface-variant uppercase tracking-wide">Color</label>
                            <input 
                                type="color"
                                value={newCategory.color}
                                onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
                                className="w-8 h-8 p-0.5 rounded cursor-pointer border border-outline-variant"
                            />
                        </div>
                        <button type="submit" className="w-8 h-8 bg-secondary text-on-secondary rounded-md flex items-center justify-center hover:bg-secondary/90 transition-colors">
                            <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                    </form>

                    {/* Category List */}
                    <div className="flex flex-col gap-2">
                        {loading ? (
                            <div className="text-center text-outline-variant py-4 text-[14px]">Cargando...</div>
                        ) : categories.length === 0 ? (
                            <div className="text-center text-outline-variant py-4 text-[14px]">No hay categorías.</div>
                        ) : (
                            categories.map(cat => (
                                <div key={cat.id} className="flex items-center justify-between p-3 border border-outline-variant/30 rounded-lg bg-surface-container-lowest">
                                    {editingId === cat.id ? (
                                        <form onSubmit={handleUpdate} className="flex-1 flex gap-2 items-center">
                                            <input 
                                                value={editForm.name}
                                                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                                className="flex-1 px-2 py-1 bg-surface-container-low border border-outline-variant rounded text-[13px] focus:outline-none"
                                                autoFocus
                                            />
                                            <input 
                                                type="color"
                                                value={editForm.color}
                                                onChange={(e) => setEditForm({...editForm, color: e.target.value})}
                                                className="w-6 h-6 p-0 border border-outline-variant"
                                            />
                                            <button type="submit" className="text-secondary hover:text-secondary/80">
                                                <span className="material-symbols-outlined text-[18px]">check</span>
                                            </button>
                                            <button type="button" onClick={() => setEditingId(null)} className="text-outline hover:text-on-surface">
                                                <span className="material-symbols-outlined text-[18px]">close</span>
                                            </button>
                                        </form>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                                <span className="text-[14px] font-medium text-on-surface">{cat.name}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => { setEditingId(cat.id); setEditForm({ name: cat.name, color: cat.color || '#000000' }); }}
                                                    className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-secondary transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(cat.id)}
                                                    className="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
