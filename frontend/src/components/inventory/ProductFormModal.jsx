import { useState, useEffect, useRef } from 'react';

export default function ProductFormModal({ isOpen, onClose, onSave, product, categories }) {
    const [formData, setFormData] = useState({
        primaryKey:     '',
        additionalKeys: [],
        name:           '',
        category_id:    '',
        cost:           '',
        price:          '',
        stock:          '',
        minStock:       '',
        maxStock:       '',
        images:         [],   // [{ file, preview }] para nuevas  |  [{ url, preview }] para existentes
    });
    const [error,  setError]  = useState('');
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (product) {
            setFormData({
                primaryKey:     product.sku            || '',
                additionalKeys: product.additional_keys || [],
                name:           product.name           || '',
                category_id:    product.category_id    || '',
                cost:           product.cost           ?? '',
                price:          product.price          || '',
                stock:          product.stock          || '',
                minStock:       product.min_stock      ?? '',
                maxStock:       product.max_stock      ?? '',
                images: (product.images || []).map(img => ({
                    url:     img.url,
                    preview: img.url,
                })),
            });
        } else {
            setFormData({
                primaryKey: '', additionalKeys: [],
                name: '', category_id: '',
                cost: '', price: '',
                stock: '0', minStock: '', maxStock: '',
                images: [],
            });
        }
        setError('');
        setSaving(false);
    }, [product, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleAddKey    = ()         => setFormData(prev => ({ ...prev, additionalKeys: [...prev.additionalKeys, ''] }));
    const handleKeyChange = (i, value) => setFormData(prev => { const k = [...prev.additionalKeys]; k[i] = value; return { ...prev, additionalKeys: k }; });
    const handleRemoveKey = (i)        => setFormData(prev => ({ ...prev, additionalKeys: prev.additionalKeys.filter((_, j) => j !== i) }));

    const handleImageAdd = (e) => {
        const files = Array.from(e.target.files);
        const newImgs = files.map(file => ({ file, preview: URL.createObjectURL(file) }));
        setFormData(prev => ({ ...prev, images: [...prev.images, ...newImgs] }));
        e.target.value = '';
    };

    const handleImageRemove = (i) => setFormData(prev => ({ ...prev, images: prev.images.filter((_, j) => j !== i) }));

    const handleSubmit = async () => {
        setError('');

        if (!formData.primaryKey.trim()) { setError('La clave principal es requerida.'); return; }
        if (!formData.name.trim())       { setError('El nombre del producto es requerido.'); return; }
        if (formData.price === '' || isNaN(formData.price) || Number(formData.price) < 0) {
            setError('Ingresa un precio válido.'); return;
        }
        if (!product && (formData.stock === '' || isNaN(formData.stock) || Number(formData.stock) < 0)) {
            setError('Ingresa un inventario inicial válido.'); return;
        }

        setSaving(true);
        try {
            const newFiles     = formData.images.filter(img => img.file);
            const existingUrls = formData.images.filter(img => !img.file).map(img => img.url);

            let allImageUrls = [...existingUrls];

            if (newFiles.length > 0) {
                // Upload directo a Cloudinary (sin pasar por el backend)
                const uploadOne = async (file) => {
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('upload_preset', 'numa_pos_images'); // ← nombre de tu preset
                    fd.append('folder', 'pos/products');

                    const res = await fetch(
                        'https://api.cloudinary.com/v1_1/dtq9fjj12/image/upload',
                        { method: 'POST', body: fd }
                    );
                    if (!res.ok) throw new Error('Error al subir imagen a Cloudinary');
                    const data = await res.json();
                    return data.secure_url;
                };

                const newUrls = await Promise.all(newFiles.map(img => uploadOne(img.file)));
                allImageUrls = [...allImageUrls, ...newUrls];
            }

            onSave({
                sku:            formData.primaryKey.trim(),
                additionalKeys: formData.additionalKeys.map(k => k.trim()).filter(Boolean),
                name:           formData.name.trim(),
                category_id:    formData.category_id ? Number(formData.category_id) : null,
                cost:           formData.cost   !== '' ? Number(formData.cost)    : null,
                price:          Number(formData.price),
                stock:          product ? undefined : Number(formData.stock),
                minStock:       formData.minStock !== '' ? Number(formData.minStock) : null,
                maxStock:       formData.maxStock !== '' ? Number(formData.maxStock) : null,
                imageUrls:      allImageUrls,
            });
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error al guardar. Intenta de nuevo.');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">

                {/* Header */}
                <div className="px-6 py-4 border-b border-outline-variant/30 flex justify-between items-center bg-surface shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-secondary text-[22px]">
                            {product ? 'edit' : 'add_box'}
                        </span>
                        <h2 className="text-[18px] font-bold text-on-surface">
                            {product ? 'Editar Producto' : 'Nuevo Producto'}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="overflow-y-auto flex-1">
                    <div className="p-6 flex flex-col gap-6">

                        {error && (
                            <div className="p-3 bg-error-container text-on-error-container text-[13px] rounded-lg flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] shrink-0">error</span>
                                {error}
                            </div>
                        )}

                        {/* Claves */}
                        <section className="flex flex-col gap-3">
                            <SectionLabel icon="key" label="Claves" />
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="flex flex-col gap-1.5 min-w-[160px]">
                                    <label className="text-[12px] font-semibold text-on-surface flex items-center gap-1">
                                        Principal <span className="text-error text-[14px] leading-none">*</span>
                                    </label>
                                    <input name="primaryKey" value={formData.primaryKey}
                                        onChange={handleChange} autoFocus
                                        className="px-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all w-full"
                                        placeholder="SKU / Código" />
                                </div>

                                {formData.additionalKeys.map((key, i) => (
                                    <div key={i} className="flex flex-col gap-1.5 min-w-[130px]">
                                        <label className="text-[12px] font-medium text-on-surface-variant">Clave {i + 2}</label>
                                        <div className="relative">
                                            <input value={key} onChange={e => handleKeyChange(i, e.target.value)}
                                                className="pl-3 pr-8 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all w-full"
                                                placeholder="Código" />
                                            <button type="button" onClick={() => handleRemoveKey(i)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-error transition-colors">
                                                <span className="material-symbols-outlined text-[15px]">close</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                <button type="button" onClick={handleAddKey}
                                    className="h-[38px] px-3.5 flex items-center gap-1.5 text-secondary border border-dashed border-secondary/50 rounded-lg hover:bg-secondary/8 hover:border-secondary transition-all text-[13px] font-medium shrink-0">
                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                    Agregar clave
                                </button>
                            </div>
                        </section>

                        {/* Nombre */}
                        <section className="flex flex-col gap-3">
                            <SectionLabel icon="label" label="Nombre del producto" />
                            <input name="name" value={formData.name} onChange={handleChange}
                                className="w-full px-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                                placeholder="Ej. Auriculares Bluetooth" />
                        </section>

                        {/* Departamento */}
                        <section className="flex flex-col gap-3">
                            <SectionLabel icon="category" label="Departamento" />
                            <select name="category_id" value={formData.category_id} onChange={handleChange}
                                className="w-full px-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all">
                                <option value="">Sin departamento</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </section>

                        {/* Precios */}
                        <section className="flex flex-col gap-3">
                            <SectionLabel icon="payments" label="Precios" />
                            <div className="flex gap-4">
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-[12px] font-medium text-on-surface-variant">Costo</label>
                                    <PriceInput name="cost" value={formData.cost} onChange={handleChange} />
                                </div>
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-[12px] font-semibold text-on-surface flex items-center gap-1">
                                        Precio <span className="text-error text-[14px] leading-none">*</span>
                                    </label>
                                    <PriceInput name="price" value={formData.price} onChange={handleChange} />
                                </div>
                            </div>
                        </section>

                        {/* Inventario */}
                        <section className="flex flex-col gap-3">
                            <SectionLabel icon="inventory_2" label="Inventario" />
                            <div className="flex gap-4">
                                {!product && (
                                    <div className="flex flex-col gap-1.5 flex-1">
                                        <label className="text-[12px] font-medium text-on-surface-variant">Inicial</label>
                                        <input name="stock" type="number" min="0" value={formData.stock} onChange={handleChange}
                                            className="w-full px-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                                            placeholder="0" />
                                    </div>
                                )}
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-[12px] font-medium text-on-surface-variant">Mínimo</label>
                                    <input name="minStock" type="number" min="0" value={formData.minStock} onChange={handleChange}
                                        className="w-full px-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                                        placeholder="—" />
                                </div>
                                <div className="flex flex-col gap-1.5 flex-1">
                                    <label className="text-[12px] font-medium text-on-surface-variant">Máximo</label>
                                    <input name="maxStock" type="number" min="0" value={formData.maxStock} onChange={handleChange}
                                        className="w-full px-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                                        placeholder="—" />
                                </div>
                            </div>
                        </section>

                        {/* Imágenes */}
                        <section className="flex flex-col gap-3">
                            <SectionLabel icon="photo_library" label="Imágenes del producto" />
                            <div className="flex flex-wrap gap-3">
                                {formData.images.map((img, i) => (
                                    <div key={i}
                                        className="relative w-[88px] h-[88px] rounded-xl overflow-hidden border border-outline-variant group shrink-0">
                                        <img src={img.preview || img.url} alt={`Imagen ${i + 1}`}
                                            className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => handleImageRemove(i)}
                                            className="absolute inset-0 bg-black/55 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="material-symbols-outlined text-white text-[22px]">delete</span>
                                        </button>
                                        {i === 0 && (
                                            <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full leading-none">
                                                Principal
                                            </span>
                                        )}
                                    </div>
                                ))}

                                <button type="button" onClick={() => fileInputRef.current?.click()}
                                    className="w-[88px] h-[88px] rounded-xl border-2 border-dashed border-outline-variant hover:border-secondary hover:bg-secondary/5 flex flex-col items-center justify-center text-outline-variant hover:text-secondary transition-all gap-0.5 shrink-0">
                                    <span className="material-symbols-outlined text-[26px]">add_photo_alternate</span>
                                    <span className="text-[10px] font-medium">Agregar</span>
                                </button>

                                <input ref={fileInputRef} type="file" accept="image/*" multiple
                                    onChange={handleImageAdd} className="hidden" />
                            </div>
                            {formData.images.length > 0 && (
                                <p className="text-[11px] text-on-surface-variant/60">
                                    La primera imagen se mostrará como imagen principal.
                                </p>
                            )}
                        </section>

                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-outline-variant/30 flex justify-end gap-3 bg-surface shrink-0">
                    <button type="button" onClick={onClose} disabled={saving}
                        className="px-5 py-2 text-secondary font-medium text-[14px] hover:bg-secondary/10 rounded-lg transition-colors disabled:opacity-40">
                        Cancelar
                    </button>
                    <button type="button" onClick={handleSubmit} disabled={saving}
                        className="px-6 py-2 bg-secondary text-on-secondary font-semibold text-[14px] rounded-lg hover:bg-secondary/90 active:scale-[0.98] transition-all shadow-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
                        {saving ? (
                            <>
                                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                Guardando…
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">save</span>
                                Guardar
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}

function SectionLabel({ icon, label }) {
    return (
        <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">{icon}</span>
            <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">{label}</span>
            <div className="flex-1 h-px bg-outline-variant/40" />
        </div>
    );
}

function PriceInput({ name, value, onChange }) {
    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-[13px] font-medium pointer-events-none">$</span>
            <input name={name} type="number" step="0.01" min="0" value={value} onChange={onChange}
                className="w-full pl-7 pr-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                placeholder="0.00" />
        </div>
    );
}