/* ═══════════════════════════════════════════════════════════════════════════
   FilterBar.jsx — Barra de filtros compartida entre secciones de Historial
═══════════════════════════════════════════════════════════════════════════ */

const DATE_FILTERS = [
    { key: 'today',  label: 'Hoy'          },
    { key: 'week',   label: 'Semana'       },
    { key: 'month',  label: 'Mes'          },
    { key: 'all',    label: 'Todo'         },
    { key: 'custom', label: 'Personalizar' },
];

export default function FilterBar({
    title,
    filter,
    setFilter,
    search,
    setSearch,
    placeholder = 'Buscar...',
    customRange,
    setCustomRange,
    onBack,
}) {
    return (
        <div className="shrink-0 bg-surface-bright border-b border-outline-variant/30">

            {/* Cabecera */}
            <div className="flex items-center gap-3 px-4 pt-3 pb-2">
                <button
                    onClick={onBack}
                    className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors shrink-0"
                >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                        arrow_back
                    </span>
                </button>
                <h2 className="font-bold text-[16px] text-on-surface flex-1">{title}</h2>
            </div>

            {/* Buscador */}
            <div className="px-4 pb-2">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                        search
                    </span>
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={placeholder}
                        className="w-full pl-9 pr-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-secondary"
                    />
                </div>
            </div>

            {/* Chips de fecha */}
            <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
                {DATE_FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                            filter === f.key
                                ? 'bg-secondary text-on-secondary'
                                : 'bg-surface-container-low text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Rango personalizado */}
            {filter === 'custom' && (
                <div className="flex gap-2 px-4 pb-3">
                    <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[10px] text-on-surface-variant font-medium px-0.5">Desde</span>
                        <input
                            type="date"
                            value={customRange.from}
                            onChange={e => setCustomRange(p => ({ ...p, from: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-secondary"
                        />
                    </div>
                    <div className="flex flex-col gap-0.5 flex-1">
                        <span className="text-[10px] text-on-surface-variant font-medium px-0.5">Hasta</span>
                        <input
                            type="date"
                            value={customRange.to}
                            onChange={e => setCustomRange(p => ({ ...p, to: e.target.value }))}
                            className="w-full px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-secondary"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}