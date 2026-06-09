import { useState, useEffect } from 'react';

const FORMATS = [
    { id: 'square', label: 'Cuadrado', desc: 'Instagram Post',       ratio: '1 : 1',  icon: 'crop_square'    },
    { id: 'story',  label: 'Historia', desc: 'Instagram / FB Story', ratio: '9 : 16', icon: 'crop_portrait'  },
    { id: 'banner', label: 'Banner',   desc: 'Facebook / Web',       ratio: '16 : 9', icon: 'crop_landscape' },
];

const CTA_OPTIONS = [
    '¡Aprovecha ya!',
    'Solo hoy',
    '¡No te lo pierdas!',
    'Válido esta semana',
    '¡Corre, es por tiempo limitado!',
];

const PALETTE = [
    { from: '#6750A4', to: '#9C84D4' },
    { from: '#1B4332', to: '#2D6A4F' },
    { from: '#C0392B', to: '#E74C3C' },
];

export default function AdCreatorModal({ isOpen, onClose, offer, offers = [] }) {
    const [step,         setStep]        = useState(1);
    const [activeOffer, setActiveOffer] = useState(offer);
    const [title,        setTitle]       = useState('');
    const [tagline,      setTagline]     = useState('');
    const [cta,          setCta]         = useState(CTA_OPTIONS[0]);
    const [format,       setFormat]      = useState('square');
    const [generating,   setGenerating]  = useState(false);
    const [generated,    setGenerated]   = useState(false);

    useEffect(() => {
        if (isOpen) {
            setActiveOffer(offer);
            setStep(1);
            setGenerating(false);
            setGenerated(false);
            setTitle('');
            setTagline('');
            setCta(CTA_OPTIONS[0]);
            setFormat('square');
        }
    }, [isOpen, offer]);

    if (!isOpen) return null;

    const handleGenerate = () => {
        setGenerating(true);
        setTimeout(() => { setGenerating(false); setGenerated(true); }, 2400);
    };

    return (
        <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }} /* Seguro anti-colapso del padre */
        >
            {/* CORRECCIÓN DEFINITIVA: Estilos en línea para garantizar el ancho y alto */}
            <div 
                className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300"
                style={{
                    width: '100%',
                    maxWidth: '512px',
                    minWidth: '320px', /* Fuerza a que no se aplaste */
                    height: 'auto',
                    maxHeight: '90vh'
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <span className="material-symbols-outlined text-purple-600 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                            Crear Publicidad con IA
                        </h2>
                        <p className="text-[12px] text-gray-500">
                            {step === 1 ? 'Personaliza el texto' : step === 2 ? 'Elige el formato' : 'Resultados generados'}
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500">
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex items-center px-6 py-3 gap-2 border-b border-gray-200 shrink-0">
                    {[1, 2, 3].map((s, idx) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${s < step ? 'bg-purple-600 text-white' : s === step ? 'border-2 border-purple-600 bg-purple-50 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                {s < step ? <span className="material-symbols-outlined text-[13px]">check</span> : s}
                            </div>
                            <span className={`text-[11px] hidden sm:inline ${s === step ? 'text-purple-600 font-semibold' : 'text-gray-500'}`}>
                                {s === 1 ? 'Texto' : s === 2 ? 'Formato' : 'Generar'}
                            </span>
                            {idx < 2 && <span className="text-gray-300 text-[14px] mx-1">›</span>}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <FieldLabel required>Oferta base</FieldLabel>
                                <select value={activeOffer?.id ?? ''} onChange={e => setActiveOffer(offers.find(o => String(o.id) === e.target.value) ?? null)} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-[13px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-all">
                                    <option value="">— Selecciona una oferta —</option>
                                    {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <FieldLabel>Título del anuncio</FieldLabel>
                                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={activeOffer ? `Ej. ¡${activeOffer.name}!` : 'Ej. ¡2x1 en Refrescos hoy!'} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-all" />
                            </div>
                            <div>
                                <FieldLabel>Descripción <span className="ml-1 text-gray-400 normal-case font-normal">(máx. 100 car.)</span></FieldLabel>
                                <textarea value={tagline} onChange={e => setTagline(e.target.value.slice(0, 100))} placeholder="Ej. Lleva 2 y paga solo 1. ¡Por tiempo limitado!" rows={3} className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-all resize-none" />
                                <p className="text-right text-[10px] text-gray-400 mt-1">{tagline.length}/100</p>
                            </div>
                            <div>
                                <FieldLabel>Llamada a la acción (CTA)</FieldLabel>
                                <div className="flex flex-wrap gap-2">
                                    {CTA_OPTIONS.map(s => (
                                        <button key={s} onClick={() => setCta(s)} className={`px-3 py-1 rounded-full text-[12px] border transition-all ${cta === s ? 'bg-purple-50 border-purple-600 text-purple-600 font-medium' : 'border-gray-300 text-gray-600 hover:border-purple-400 hover:bg-purple-50/5'}`}>{s}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-3">
                            <p className="text-[13px] text-gray-500 mb-2">Elige el formato de imagen para tu publicidad.</p>
                            {FORMATS.map(f => {
                                const active = format === f.id;
                                return (
                                    <button key={f.id} onClick={() => setFormat(f.id)} className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${active ? 'border-purple-600 bg-purple-50/50 shadow-sm' : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50/10'}`}>
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            <span className="material-symbols-outlined text-[20px]">{f.icon}</span>
                                        </div>
                                        <div className="flex-1">
                                            <p className={`font-bold text-[14px] ${active ? 'text-purple-600' : 'text-gray-900'}`}>{f.label}</p>
                                            <p className="text-[12px] text-gray-500">{f.desc} · {f.ratio}</p>
                                        </div>
                                        {active && <span className="material-symbols-outlined text-purple-600 text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {step === 3 && generating && (
                        <div className="flex flex-col items-center justify-center py-10 gap-4">
                            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center animate-pulse">
                                <span className="material-symbols-outlined text-purple-600 text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="font-bold text-[15px] text-gray-900">Generando diseños...</p>
                                <p className="text-[13px] text-gray-500">La IA está creando 3 variaciones</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3 w-full mt-4">
                                {[1, 2, 3].map(i => <div key={i} className="aspect-square rounded-xl bg-gray-100 animate-pulse" />)}
                            </div>
                        </div>
                    )}

                    {step === 3 && generated && (
                        <div className="space-y-4">
                            <p className="text-[13px] text-gray-500">¡Listo! Elige la versión que más te guste.</p>
                            <div className="grid grid-cols-3 gap-3">
                                {PALETTE.map((color, i) => (
                                    <div key={i} className="group relative aspect-square rounded-xl overflow-hidden shadow-md cursor-pointer hover:shadow-xl transition-all">
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2" style={{ background: `linear-gradient(135deg, ${color.from}ee, ${color.to}99)` }}>
                                            <span className="material-symbols-outlined text-white text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                                            <p className="text-white text-[8px] font-bold text-center leading-tight opacity-90 line-clamp-2">{title || activeOffer?.name || 'Promo'}</p>
                                            <p className="text-white/70 text-[6px] text-center">{cta}</p>
                                        </div>
                                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-900 hover:bg-white transition-colors" title="Descargar">
                                                <span className="material-symbols-outlined text-[17px]">download</span>
                                            </button>
                                            <button className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center text-gray-900 hover:bg-white transition-colors" title="Guardar">
                                                <span className="material-symbols-outlined text-[17px]">bookmark</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => { setGenerated(false); handleGenerate(); }} className="w-full py-2 border border-gray-300 rounded-xl text-[13px] text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[16px]">refresh</span>
                                Regenerar opciones
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 shrink-0 flex items-center justify-between gap-3">
                    <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()} className="px-4 py-2 border border-gray-300 text-gray-600 rounded-xl text-[13px] font-medium hover:bg-gray-50 transition-colors">
                        {step === 1 ? 'Cancelar' : 'Atrás'}
                    </button>
                    {step === 1 && (
                        <button onClick={() => setStep(2)} disabled={!activeOffer} className="px-5 py-2 bg-purple-600 text-white rounded-xl text-[13px] font-bold flex items-center gap-1 hover:bg-purple-700 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                            Siguiente <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
                        </button>
                    )}
                    {step === 2 && (
                        <button onClick={() => { setStep(3); handleGenerate(); }} className="px-5 py-2 bg-purple-600 text-white rounded-xl text-[13px] font-bold flex items-center gap-1 hover:bg-purple-700 transition-all active:scale-95">
                            <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                            Generar con IA
                        </button>
                    )}
                    {step === 3 && generated && (
                        <button onClick={onClose} className="px-5 py-2 bg-purple-600 text-white rounded-xl text-[13px] font-bold hover:bg-purple-700 transition-all active:scale-95">Listo</button>
                    )}
                </div>
            </div>
        </div>
    );
}

function FieldLabel({ children, required }) {
    return (
        <label className="font-semibold text-gray-700 uppercase tracking-wide text-[10px] mb-1 block">
            {children}{required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
    );
}