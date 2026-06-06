/* ═══════════════════════════════════════════════════════════════════════════
   MenuPanel.jsx — Menú de selección de sección en Historial
═══════════════════════════════════════════════════════════════════════════ */

const ITEMS = [
    {
        key:   'sales',
        icon:  'receipt_long',
        label: 'Ventas',
        desc:  'Historial de todas las ventas registradas',
        color: 'bg-emerald-50 text-emerald-600',
    },
    {
        key:   'adjustments',
        icon:  'inventory',
        label: 'Ajustes de inventario',
        desc:  'Entradas, salidas y correcciones de stock',
        color: 'bg-blue-50 text-blue-600',
    },
    {
        key:   'cortes',
        icon:  'point_of_sale',
        label: 'Cortes de caja',
        desc:  'Resumen de cortes realizados por caja',
        color: 'bg-purple-50 text-purple-600',
    },
];

export default function MenuPanel({ onSelect }) {
    return (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-2xl mx-auto w-full">
            <h1 className="text-2xl font-black text-on-surface mb-1">Historial</h1>
            <p className="text-sm text-on-surface-variant mb-6">
                Selecciona la sección que deseas consultar
            </p>

            <div className="flex flex-col gap-3">
                {ITEMS.map(item => (
                    <button
                        key={item.key}
                        onClick={() => onSelect(item.key)}
                        className="flex items-center gap-4 p-4 rounded-2xl bg-surface-bright border border-outline-variant/30 hover:border-secondary/40 hover:shadow-sm transition-all text-left active:scale-[0.99] group"
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                            <span
                                className="material-symbols-outlined text-[24px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                                {item.icon}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-[15px] text-on-surface">{item.label}</p>
                            <p className="text-[12px] text-on-surface-variant mt-0.5">{item.desc}</p>
                        </div>
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant group-hover:text-secondary transition-colors">
                            chevron_right
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}