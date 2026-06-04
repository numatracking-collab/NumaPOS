import { useState } from 'react';
import BottomNav from '../components/BottomNav';
import DevicesPanel from '../components/settings/DevicesPanel';

const MENU_ITEMS = [
  { id: 'business',  label: 'Negocio',      icon: 'store',           disabled: true  },
  { id: 'devices',   label: 'Dispositivos', icon: 'devices',         disabled: false },
  { id: 'users',     label: 'Usuarios',     icon: 'group',           disabled: true  },
  { id: 'account',   label: 'Cuenta',       icon: 'manage_accounts', disabled: true  },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('devices');

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <header className="shrink-0 bg-surface-bright border-b border-outline-variant px-4 md:px-6 h-14 flex items-center gap-3 z-10">
        <span
          className="material-symbols-outlined text-[22px] text-secondary"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          settings
        </span>
        <h1 className="font-semibold text-on-surface text-base">Ajustes</h1>
      </header>

      {/* ── Cuerpo: sidebar + contenido ────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar izquierdo
            · Móvil  → solo íconos (w-14 = 56 px)
            · Tablet/Escritorio → ícono + texto (w-52 = 208 px)       */}
        <aside className="w-14 md:w-52 shrink-0 bg-surface border-r border-outline-variant
                          overflow-y-auto custom-scrollbar py-2 flex flex-col gap-0.5">
          {MENU_ITEMS.map(item => {
            const isActive = !item.disabled && activeSection === item.id;
            return (
              <button
                key={item.id}
                disabled={item.disabled}
                title={item.label}
                onClick={() => !item.disabled && setActiveSection(item.id)}
                className={[
                  'flex items-center gap-3 mx-1.5 px-2.5 md:px-3 py-2.5 rounded-xl transition-colors',
                  item.disabled
                    ? 'opacity-35 cursor-not-allowed text-on-surface-variant'
                    : isActive
                      ? 'bg-secondary/10 text-secondary'
                      : 'text-on-surface-variant hover:bg-surface-container-high',
                ].join(' ')}
              >
                <span
                  className="material-symbols-outlined text-[21px] shrink-0"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {item.icon}
                </span>
                <span className="hidden md:block text-[13px] font-medium truncate leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </aside>

        {/* Panel derecho */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-background">
          {activeSection === 'devices' && <DevicesPanel />}
        </main>
      </div>

      {/* ── Barra inferior ─────────────────────────────────────────── */}
      <BottomNav />
    </div>
  );
}