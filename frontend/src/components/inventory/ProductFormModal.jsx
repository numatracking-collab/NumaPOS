import { useState, useEffect, useRef } from 'react';
import CategoryManagerModal from './CategoryManagerModal';
import BarcodeScannerModal  from '../shared/BarcodeScannerModal';
import { categoryService }  from '../../services/api';

const UNITS = [
    { value: 'Pza',      label: 'Pieza (Pza)' },
    { value: 'kg',       label: 'Kilogramo (kg)' },
    { value: 'l',        label: 'Litro (l)' },
    { value: 'm',        label: 'Metro (m)' },
    { value: 'servicio', label: 'Servicio' },
];

export default function ProductFormModal({ isOpen, onClose, onSave, product, categories: categoriesProp }) {
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
        unit:           'Pza',
        allowFractions: false,
        images:         [],
    });
    const [error,  setError]  = useState('');
    const [saving, setSaving] = useState(false);

    // Categories state — owned here so CategoryManagerModal can refresh it
    const [categories, setCategories] = useState(categoriesProp || []);

    // Sync when parent passes new categories (e.g. initial load)
    useEffect(() => {
        setCategories(categoriesProp || []);
    }, [categoriesProp]);

    // Category dropdown state
    const [catDropOpen,    setCatDropOpen]    = useState(false);
    const [catSearch,      setCatSearch]      = useState('');
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const catDropRef   = useRef(null);
    const catSearchRef = useRef(null);

    // File inputs
    const fileInputRef   = useRef(null); // galería
    const cameraInputRef = useRef(null); // cámara (mobile)

    // ── Escáner de códigos de barras ──────────────────────────────────────────
    // scannerTarget: 'primary' | { type: 'additional', index: number } | null
    const [scannerOpen,   setScannerOpen]   = useState(false);
    const [scannerTarget, setScannerTarget] = useState(null);

    /**
     * Abre el escáner apuntando al campo indicado.
     * @param {'primary' | { type: 'additional', index: number }} target
     */
    const openScanner = (target) => {
        setScannerTarget(target);
        setScannerOpen(true);
    };

    /**
     * Callback cuando ZXing detecta un código.
     * Rellena el campo activo y deja el modal abierto para seguir escaneando.
     */
    const handleScanDetected = (code) => {
        if (scannerTarget === 'primary') {
            setFormData(prev => ({ ...prev, primaryKey: code }));
        } else if (scannerTarget?.type === 'additional') {
            const idx = scannerTarget.index;
            setFormData(prev => {
                const keys = [...prev.additionalKeys];
                keys[idx]  = code;
                return { ...prev, additionalKeys: keys };
            });
        }
        // No se cierra — el usuario cierra manualmente
    };
    // ─────────────────────────────────────────────────────────────────────────

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (catDropRef.current && !catDropRef.current.contains(e.target)) {
                setCatDropOpen(false);
                setCatSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus search when dropdown opens
    useEffect(() => {
        if (catDropOpen) {
            setTimeout(() => catSearchRef.current?.focus(), 50);
        }
    }, [catDropOpen]);

    useEffect(() => {
        if (product) {
            setFormData({
                primaryKey:     product.sku             || '',
                additionalKeys: product.additional_keys  || [],
                name:           product.name             || '',
                category_id:    product.category_id      || '',
                cost:           product.cost             ?? '',
                price:          product.price            || '',
                stock:          product.stock            || '',
                minStock:       product.min_stock        ?? '',
                maxStock:       product.max_stock        ?? '',
                unit:           product.unit             || 'Pza',
                allowFractions: product.allow_fractions  ?? false,
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
                unit: 'Pza',
                allowFractions: false,
                images: [],
            });
        }
        setError('');
        setSaving(false);
        setCatDropOpen(false);
        setCatSearch('');
    }, [product, isOpen]);

    if (!isOpen) return null;

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleToggleFractions = () =>
        setFormData(prev => ({ ...prev, allowFractions: !prev.allowFractions }));

    const handleAddKey    = ()         => setFormData(prev => ({ ...prev, additionalKeys: [...prev.additionalKeys, ''] }));
    const handleKeyChange = (i, value) => setFormData(prev => { const k = [...prev.additionalKeys]; k[i] = value; return { ...prev, additionalKeys: k }; });
    const handleRemoveKey = (i)        => setFormData(prev => ({ ...prev, additionalKeys: prev.additionalKeys.filter((_, j) => j !== i) }));

    // Agrega imágenes desde galería o cámara (ambos inputs usan el mismo handler)
    const handleImageAdd = (e) => {
        const files = Array.from(e.target.files);
        const newImgs = files.map(file => ({ file, preview: URL.createObjectURL(file) }));
        setFormData(prev => ({ ...prev, images: [...prev.images, ...newImgs] }));
        e.target.value = '';
    };

    const handleImageRemove = (i) => setFormData(prev => ({ ...prev, images: prev.images.filter((_, j) => j !== i) }));

    // Called when CategoryManagerModal saves/updates categories
    const handleCategoriesUpdated = async () => {
        try {
            const fresh = await categoryService.getAll();
            setCategories(fresh);
        } catch (_) {}
    };

    // Category dropdown helpers
    const selectedCategory = categories.find(c => c.id === Number(formData.category_id));
    const filteredCats = categories.filter(c =>
        c.name.toLowerCase().includes(catSearch.toLowerCase())
    );

    const selectCategory = (cat) => {
        setFormData(prev => ({ ...prev, category_id: cat ? cat.id : '' }));
        setCatDropOpen(false);
        setCatSearch('');
    };

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
                const uploadOne = async (file) => {
                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('upload_preset', 'numa_pos_images');
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
                cost:           formData.cost   !== '' ? Number(formData.cost)   : null,
                price:          Number(formData.price),
                stock:          product ? undefined : Number(formData.stock),
                minStock:       formData.minStock !== '' ? Number(formData.minStock) : null,
                maxStock:       formData.maxStock !== '' ? Number(formData.maxStock) : null,
                unit:           formData.unit,
                allowFractions: formData.allowFractions,
                imageUrls:      allImageUrls,
            });
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error al guardar. Intenta de nuevo.');
            setSaving(false);
        }
    };

    return (
        <>
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

                            {/* ── Claves ─────────────────────────────────────────────────────── */}
                            <section className="flex flex-col gap-3">
                                <SectionLabel icon="key" label="Claves" />
                                <div className="flex flex-wrap items-end gap-3">

                                    {/* Clave principal */}
                                    <div className="flex flex-col gap-1.5 min-w-[160px]">
                                        <label className="text-[12px] font-semibold text-on-surface flex items-center gap-1">
                                            Principal <span className="text-error text-[14px] leading-none">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                name="primaryKey"
                                                value={formData.primaryKey}
                                                onChange={handleChange}
                                                autoFocus
                                                /* pr-10 en móvil para el botón del escáner; sm:pr-3 en desktop */
                                                className="px-3 py-[9px] pr-10 sm:pr-3 bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all w-full"
                                                placeholder="SKU / Código"
                                            />
                                            {/* Botón escáner — solo en móvil */}
                                            <button
                                                type="button"
                                                title="Escanear código"
                                                onClick={() => openScanner('primary')}
                                                className="sm:hidden absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-secondary/70 active:scale-90 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">
                                                    qr_code_scanner
                                                </span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Claves adicionales */}
                                    {formData.additionalKeys.map((key, i) => (
                                        <div key={i} className="flex flex-col gap-1.5 min-w-[130px]">
                                            <label className="text-[12px] font-medium text-on-surface-variant">
                                                Clave {i + 2}
                                            </label>
                                            <div className="relative">
                                                <input
                                                    value={key}
                                                    onChange={e => handleKeyChange(i, e.target.value)}
                                                    /* En móvil: espacio para escáner + cerrar (pr-16); en desktop: solo cerrar (pr-8) */
                                                    className="pl-3 pr-16 sm:pr-8 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all w-full"
                                                    placeholder="Código"
                                                />
                                                {/* Botón escáner — solo en móvil */}
                                                <button
                                                    type="button"
                                                    title="Escanear código"
                                                    onClick={() => openScanner({ type: 'additional', index: i })}
                                                    className="sm:hidden absolute right-8 top-1/2 -translate-y-1/2 text-secondary hover:text-secondary/70 active:scale-90 transition-all"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">
                                                        qr_code_scanner
                                                    </span>
                                                </button>
                                                {/* Botón eliminar clave */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveKey(i)}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-error transition-colors"
                                                >
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

                            {/* ── Nombre ─────────────────────────────────────────────────────── */}
                            <section className="flex flex-col gap-3">
                                <SectionLabel icon="label" label="Nombre del producto" />
                                <input name="name" value={formData.name} onChange={handleChange}
                                    className="w-full px-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                                    placeholder="Ej. Auriculares Bluetooth" />
                            </section>

                            {/* ── Categoría — custom dropdown ─────────────────────────────── */}
                            <section className="flex flex-col gap-3">
                                <SectionLabel icon="category" label="Categoría" />

                                <div className="relative" ref={catDropRef}>
                                    {/* Trigger */}
                                    <button
                                        type="button"
                                        onClick={() => setCatDropOpen(prev => !prev)}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-[9px]
                                            bg-surface-container-low border rounded-lg text-[14px] transition-all
                                            ${catDropOpen
                                                ? 'border-secondary ring-2 ring-secondary'
                                                : 'border-outline-variant hover:border-secondary/50'}
                                        `}
                                    >
                                        <span className={`flex items-center gap-2 ${selectedCategory ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>
                                            {selectedCategory ? (
                                                <>
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: selectedCategory.color || '#94a3b8' }}
                                                    />
                                                    {selectedCategory.name}
                                                </>
                                            ) : (
                                                'Sin categoría'
                                            )}
                                        </span>
                                        <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-200 ${catDropOpen ? 'rotate-180' : ''}`}>
                                            expand_more
                                        </span>
                                    </button>

                                    {/* Dropdown panel */}
                                    {catDropOpen && (
                                        <div className="absolute z-[200] mt-1.5 w-full bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xl overflow-hidden">

                                            {/* Search + new button */}
                                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-outline-variant/30">
                                                <span className="material-symbols-outlined text-[16px] text-on-surface-variant shrink-0">search</span>
                                                <input
                                                    ref={catSearchRef}
                                                    value={catSearch}
                                                    onChange={e => setCatSearch(e.target.value)}
                                                    placeholder="Buscar categoría…"
                                                    className="flex-1 bg-transparent text-[13px] text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    title="Nueva categoría"
                                                    onClick={() => {
                                                        setCatDropOpen(false);
                                                        setCatSearch('');
                                                        setIsCatModalOpen(true);
                                                    }}
                                                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-secondary text-on-secondary hover:bg-secondary/90 transition-colors shrink-0"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                                </button>
                                            </div>

                                            {/* Options list */}
                                            <ul className="max-h-48 overflow-y-auto py-1">
                                                {/* "Sin categoría" option */}
                                                <li>
                                                    <button
                                                        type="button"
                                                        onClick={() => selectCategory(null)}
                                                        className={`
                                                            w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 transition-colors
                                                            ${!formData.category_id
                                                                ? 'bg-secondary/10 text-secondary font-medium'
                                                                : 'text-on-surface-variant hover:bg-surface-container-low'}
                                                        `}
                                                    >
                                                        <span className="w-2.5 h-2.5 rounded-full border border-outline-variant/60 shrink-0" />
                                                        Sin categoría
                                                    </button>
                                                </li>

                                                {filteredCats.length === 0 && catSearch ? (
                                                    <li className="px-3 py-3 text-[12px] text-on-surface-variant/60 text-center">
                                                        No hay resultados para "{catSearch}"
                                                    </li>
                                                ) : (
                                                    filteredCats.map(cat => (
                                                        <li key={cat.id}>
                                                            <button
                                                                type="button"
                                                                onClick={() => selectCategory(cat)}
                                                                className={`
                                                                    w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 transition-colors
                                                                    ${formData.category_id === cat.id
                                                                        ? 'bg-secondary/10 text-secondary font-medium'
                                                                        : 'text-on-surface hover:bg-surface-container-low'}
                                                                `}
                                                            >
                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                                                    style={{ backgroundColor: cat.color || '#94a3b8' }}
                                                                />
                                                                {cat.name}
                                                            </button>
                                                        </li>
                                                    ))
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* ── Unidad de venta ─────────────────────────────────────────── */}
                            <section className="flex flex-col gap-3">
                                <SectionLabel icon="straighten" label="Unidad de venta" />
                                <div className="flex flex-col sm:flex-row gap-4">

                                    <div className="flex flex-col gap-1.5 flex-1">
                                        <label className="text-[12px] font-semibold text-on-surface flex items-center gap-1">
                                            Unidad <span className="text-error text-[14px] leading-none">*</span>
                                        </label>
                                        <select
                                            name="unit"
                                            value={formData.unit}
                                            onChange={handleChange}
                                            className="w-full px-3 py-[9px] bg-surface-container-low border border-outline-variant rounded-lg text-[14px] focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                                        >
                                            {UNITS.map(u => (
                                                <option key={u.value} value={u.value}>{u.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex flex-col gap-1.5 flex-1">
                                        <label className="text-[12px] font-medium text-on-surface-variant">
                                            Venta fraccionada
                                        </label>
                                        <button
                                            type="button"
                                            onClick={handleToggleFractions}
                                            className={`
                                                flex items-center gap-3 px-4 py-[9px] rounded-lg border transition-all text-left h-[38px]
                                                ${formData.allowFractions
                                                    ? 'bg-secondary/10 border-secondary'
                                                    : 'bg-surface-container-low border-outline-variant'}
                                            `}
                                        >
                                            <span className={`
                                                relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200
                                                ${formData.allowFractions ? 'bg-secondary' : 'bg-outline-variant'}
                                            `}>
                                                <span className={`
                                                    inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5
                                                    ${formData.allowFractions ? 'translate-x-5' : 'translate-x-0.5'}
                                                `} />
                                            </span>
                                            <span className={`text-[13px] font-medium leading-tight ${formData.allowFractions ? 'text-secondary' : 'text-on-surface-variant'}`}>
                                                {formData.allowFractions
                                                    ? <><strong>Sí</strong> — permite 1.5, 0.75…</>
                                                    : <><strong>No</strong> — solo cantidades enteras</>}
                                            </span>
                                        </button>
                                    </div>

                                </div>
                            </section>

                            {/* ── Precios ─────────────────────────────────────────────────── */}
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

                            {/* ── Inventario ──────────────────────────────────────────────── */}
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

                            {/* ── Imágenes ─────────────────────────────────────────────────── */}
                            <section className="flex flex-col gap-3">
                                <SectionLabel icon="photo_library" label="Imágenes del producto" />
                                <div className="flex flex-wrap gap-3">

                                    {/* Thumbnails existentes */}
                                    {formData.images.map((img, i) => (
                                        <div key={i}
                                            className="relative w-[88px] h-[88px] rounded-xl overflow-hidden border border-outline-variant group shrink-0">
                                            <img
                                                src={img.preview || img.url}
                                                alt={`Imagen ${i + 1}`}
                                                className="w-full h-full object-cover"
                                            />
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

                                    {/* Botón galería */}
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-[88px] h-[88px] rounded-xl border-2 border-dashed border-outline-variant hover:border-secondary hover:bg-secondary/5 flex flex-col items-center justify-center text-outline-variant hover:text-secondary transition-all gap-0.5 shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-[26px]">add_photo_alternate</span>
                                        <span className="text-[10px] font-medium">Galería</span>
                                    </button>

                                    {/* Botón cámara — solo en móvil (capture="environment" abre cámara trasera) */}
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="sm:hidden w-[88px] h-[88px] rounded-xl border-2 border-dashed border-secondary/40 hover:border-secondary hover:bg-secondary/5 flex flex-col items-center justify-center text-secondary/60 hover:text-secondary transition-all gap-0.5 shrink-0"
                                    >
                                        <span className="material-symbols-outlined text-[26px]">photo_camera</span>
                                        <span className="text-[10px] font-medium">Cámara</span>
                                    </button>

                                    {/* Input oculto — galería (múltiples) */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={handleImageAdd}
                                        className="hidden"
                                    />

                                    {/* Input oculto — cámara trasera (capture) */}
                                    <input
                                        ref={cameraInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleImageAdd}
                                        className="hidden"
                                    />
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

            {/* ── CategoryManagerModal ── */}
            <CategoryManagerModal
                isOpen={isCatModalOpen}
                onClose={() => setIsCatModalOpen(false)}
                onCategoriesUpdated={handleCategoriesUpdated}
            />

            {/* ── BarcodeScannerModal — z-350 para estar sobre todo lo demás ── */}
            <BarcodeScannerModal
                isOpen={scannerOpen}
                onClose={() => {
                    setScannerOpen(false);
                    setScannerTarget(null);
                }}
                onDetected={handleScanDetected}
                title={
                    scannerTarget === 'primary'
                        ? 'Escanear clave principal'
                        : scannerTarget?.type === 'additional'
                            ? `Escanear clave ${(scannerTarget.index + 2)}`
                            : 'Escanear código'
                }
            />
        </>
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