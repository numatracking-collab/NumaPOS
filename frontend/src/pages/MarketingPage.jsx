/* ═══════════════════════════════════════════════════════════════════════════
   MarketingPage.jsx — Página principal de Marketing & Promociones
   • Tab 'create' soporta modo edición (recibe initialOffer)
   • onEditOffer(offer) desde MyOffersPanel lleva al tab create con la oferta
═══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import TopAppBar      from '../components/TopAppBar';
import BottomNav      from '../components/BottomNav';
import CreateOfferPanel from '../components/marketing/CreateOfferPanel';
import MyOffersPanel    from '../components/marketing/MyOffersPanel';
import MyImagesPanel    from '../components/marketing/MyImagesPanel';

const TABS = [
    { id: 'offers', label: 'Mis Ofertas',  icon: 'storefront'    },
    { id: 'create', label: 'Crear Oferta', icon: 'add_circle'    },
    { id: 'images', label: 'Mis Imágenes', icon: 'photo_library' },
];

export default function MarketingPage() {
    const [activeTab,    setActiveTab]    = useState('offers');
    const [editingOffer, setEditingOffer] = useState(null); // oferta a editar, o null

    // Cuando se crea o edita una oferta, vuelve a la lista
    const handleOfferSaved = () => {
        setEditingOffer(null);
        setActiveTab('offers');
    };

    // Desde MyOffersPanel: abrir el formulario con una oferta existente
    const handleEditOffer = (offer) => {
        setEditingOffer(offer);
        setActiveTab('create');
    };

    // Al cambiar de tab manualmente, limpiar la oferta en edición
    const handleTabChange = (tabId) => {
        if (tabId !== 'create') setEditingOffer(null);
        setActiveTab(tabId);
    };

    // Label dinámico del tab Crear / Editar
    const createTabLabel = editingOffer ? 'Editar Oferta' : 'Crear Oferta';

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background">
            <TopAppBar hideActions placeholder="Buscar en marketing..." />

            {/* ── Header + tabs ── */}
            <div className="shrink-0 bg-surface-bright border-b border-outline-variant">
                <div className="hidden md:flex items-end justify-between px-lg pt-md">
                    <div>
                        <h1 className="font-headline-md text-headline-md text-on-surface">
                            Marketing &amp; Promociones
                        </h1>
                        <p className="text-[12px] text-on-surface-variant pb-sm">
                            Diseña ofertas y crea publicidad con IA para tu tienda
                        </p>
                    </div>
                    <button
                        onClick={() => handleTabChange('create')}
                        className="mb-sm flex items-center gap-xs px-md py-sm bg-secondary text-on-secondary rounded-xl font-label-bold text-label-bold hover:bg-secondary/90 transition-all active:scale-95 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[18px]">add</span>
                        Nueva Oferta
                    </button>
                </div>

                <nav className="flex px-lg overflow-x-auto no-scrollbar">
                    {TABS.map(tab => {
                        const label = tab.id === 'create' ? createTabLabel : tab.label;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center gap-xs px-md py-[10px] text-[13px] font-medium border-b-2 transition-all whitespace-nowrap ${
                                    isActive
                                        ? 'border-secondary text-secondary'
                                        : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant/60'
                                }`}
                            >
                                <span
                                    className="material-symbols-outlined text-[17px]"
                                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                    {tab.icon}
                                </span>
                                {label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ── Contenido ── */}
            <main className="flex-1 overflow-hidden">
                {activeTab === 'offers' && (
                    <MyOffersPanel
                        onCreateOffer={() => handleTabChange('create')}
                        onEditOffer={handleEditOffer}
                    />
                )}
                {activeTab === 'create' && (
                    <CreateOfferPanel
                        onSaved={handleOfferSaved}
                        initialOffer={editingOffer}
                    />
                )}
                {activeTab === 'images' && <MyImagesPanel />}
            </main>

            <BottomNav />
        </div>
    );
}