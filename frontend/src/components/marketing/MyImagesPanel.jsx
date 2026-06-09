import { useState } from 'react';

// TODO: reemplazar con marketingService.getImages()
const MOCK_IMAGES = [
    { id: 1, offerName: 'Promo Fin de Semana',     format: 'square', date: '2026-06-07', from: '#6750A4', to: '#9C84D4' },
    { id: 2, offerName: 'Miércoles de Descuento',  format: 'story',  date: '2026-06-05', from: '#1B4332', to: '#2D6A4F' },
    { id: 3, offerName: 'Mitad de Precio Lácteos', format: 'banner', date: '2026-06-01', from: '#C0392B', to: '#E74C3C' },
    { id: 4, offerName: 'Promo Fin de Semana',     format: 'story',  date: '2026-06-07', from: '#1A4A6E', to: '#2E86C1' },
    { id: 5, offerName: 'Miércoles de Descuento',  format: 'square', date: '2026-06-05', from: '#6C3483', to: '#9B59B6' },
    { id: 6, offerName: 'Mitad de Precio Lácteos', format: 'square', date: '2026-06-01', from: '#BA4A00', to: '#E67E22' },
];

const FORMAT_LABELS = { square: 'Post 1:1', story: 'Historia 9:16', banner: 'Banner 16:9' };

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y.slice(2)}`;
}

export default function MyImagesPanel() {
    const [filter, setFilter] = useState('all');

    const offerFilters = [
        { id: 'all', label: 'Todas' },
        ...Array.from(new Map(MOCK_IMAGES.map(img => [img.offerName, { id: img.offerName, label: img.offerName }])).values()),
    ];

    const filtered = filter === 'all' ? MOCK_IMAGES : MOCK_IMAGES.filter(img => img.offerName === filter);

    if (MOCK_IMAGES.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-md text-on-surface-variant px-lg text-center">
                <span className="material-symbols-outlined text-[64px]">photo_library</span>
                <div>
                    <p className="font-bold text-[18px] text-on-surface mb-xs">No tienes imágenes aún</p>
                    <p className="text-[13px]">Abre una oferta y presiona <strong>Crear Publicidad</strong> para generar tu primera imagen.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <div className="shrink-0 px-lg py-sm border-b border-outline-variant bg-surface-bright flex items-center gap-sm">
                <div className="flex gap-xs overflow-x-auto no-scrollbar flex-1">
                    {offerFilters.map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)} className={`px-md py-xs rounded-full text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${filter === f.id ? 'bg-secondary/15 text-secondary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <span className="text-[11px] text-on-surface-variant shrink-0">{filtered.length} imágenes</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-lg">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-md">
                    {filtered.map(img => <ImageCard key={img.id} image={img} />)}
                </div>
            </div>
        </div>
    );
}

function ImageCard({ image }) {
    return (
        <div className="group relative rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all cursor-pointer">
            <div className="aspect-square flex flex-col items-center justify-center gap-xs p-md" style={{ background: `linear-gradient(135deg, ${image.from}ee, ${image.to}88)` }}>
                <span className="material-symbols-outlined text-white text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <p className="text-white text-[9px] font-bold text-center leading-tight opacity-90 line-clamp-2">{image.offerName}</p>
                <span className="text-white/60 text-[8px]">{FORMAT_LABELS[image.format]}</span>
            </div>
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-sm">
                <ActionBtn icon="download" title="Descargar" />
                <ActionBtn icon="share"    title="Compartir" />
                <ActionBtn icon="delete"   title="Eliminar" danger />
            </div>
            <div className="bg-surface-container-lowest px-sm py-xs border-t border-outline-variant/30">
                <p className="text-[10px] text-on-surface-variant truncate">{image.offerName}</p>
                <div className="flex items-center justify-between">
                    <p className="text-[9px] text-outline">{formatDate(image.date)}</p>
                    <span className="text-[8px] font-mono text-outline-variant">{FORMAT_LABELS[image.format]}</span>
                </div>
            </div>
        </div>
    );
}

function ActionBtn({ icon, title, danger }) {
    return (
        <button title={title} className={`w-9 h-9 rounded-full bg-white/90 flex items-center justify-center transition-colors ${danger ? 'hover:bg-error hover:text-on-error text-error' : 'hover:bg-secondary hover:text-on-secondary text-on-surface'}`}>
            <span className="material-symbols-outlined text-[17px]">{icon}</span>
        </button>
    );
}