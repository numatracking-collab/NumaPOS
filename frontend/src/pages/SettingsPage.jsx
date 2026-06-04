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

      {/* ── Navegación móvil: barra de pestañas horizontal scrollable ──
          Reemplaza al sidebar de íconos solos (w-14) en pantallas pequeñas.
          Muestra ícono + texto → accesible sin necesidad de adivinar el ícono. */}
      <nav className="md:hidden shrink-0 flex overflow-x-auto bg-surface border-b border-outline-variant
                      px-2 py-1.5 gap-1 custom-scrollbar" style={{ scrollbarWidth: 'none' }}>
        {MENU_ITEMS.map(item => {
          const isActive = !item.disabled && activeSection === item.id;
          return (
            <button
              key={item.id}
              disabled={item.disabled}
              onClick={() => !item.disabled && setActiveSection(item.id)}
              className={[
                'flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap shrink-0 transition-colors',
                item.disabled
                  ? 'opacity-35 cursor-not-allowed text-on-surface-variant'
                  : isActive
                    ? 'bg-secondary/10 text-secondary'
                    : 'text-on-surface-variant active:bg-surface-container-high',
              ].join(' ')}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="text-[13px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Cuerpo ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar izquierdo — solo visible en md+, sin cambios respecto al original */}
        <aside className="hidden md:flex w-52 shrink-0 bg-surface border-r border-outline-variant
                          overflow-y-auto custom-scrollbar py-2 flex-col gap-0.5">
          {MENU_ITEMS.map(item => {
            const isActive = !item.disabled && activeSection === item.id;
            return (
              <button
                key={item.id}
                disabled={item.disabled}
                title={item.label}
                onClick={() => !item.disabled && setActiveSection(item.id)}
                className={[
                  'flex items-center gap-3 mx-1.5 px-3 py-2.5 rounded-xl transition-colors',
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
                <span className="text-[13px] font-medium truncate leading-none">
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