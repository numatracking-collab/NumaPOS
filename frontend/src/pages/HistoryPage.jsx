/* ═══════════════════════════════════════════════════════════════════════════
   HistoryPage.jsx — Orquestador de la sección Historial
   Solo enruta entre secciones; toda la lógica vive en cada sub-componente.
═══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import TopAppBar  from '../components/TopAppBar';
import BottomNav  from '../components/BottomNav';

import MenuPanel          from '../components/history/menupanel';
import SalesSection       from '../components/SalesSection';
import AdjustmentsSection from '../components/adjustments/AdjustmentsSection';
import CortesSection      from '../components/cortes/CortesSection';

export default function HistoryPage() {
    // 'menu' | 'sales' | 'adjustments' | 'cortes'
    const [section,    setSection]    = useState('menu');
    // Móvil: 'list' | 'detail'
    const [mobileView, setMobileView] = useState('list');

    const handleSelectSection = (s) => {
        setSection(s);
        setMobileView('list');
    };

    const handleBack = () => {
        if (mobileView === 'detail') {
            setMobileView('list');
            return;
        }
        setSection('menu');
    };

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-background">
            <TopAppBar hideActions searchValue="" onSearchChange={() => {}} />

            <main className="flex-1 overflow-hidden flex flex-col min-h-0">
                {section === 'menu' && (
                    <MenuPanel onSelect={handleSelectSection} />
                )}

                {section === 'sales' && (
                    <SalesSection
                        mobileView={mobileView}
                        setMobileView={setMobileView}
                        onBack={handleBack}
                    />
                )}

                {section === 'adjustments' && (
                    <AdjustmentsSection
                        mobileView={mobileView}
                        setMobileView={setMobileView}
                        onBack={handleBack}
                    />
                )}

                {section === 'cortes' && (
                    <CortesSection
                        mobileView={mobileView}
                        setMobileView={setMobileView}
                        onBack={handleBack}
                    />
                )}
            </main>

            <BottomNav />
        </div>
    );
}