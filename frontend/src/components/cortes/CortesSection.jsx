/* ═══════════════════════════════════════════════════════════════════════════
   CortesSection.jsx — Panel de lista de cortes de caja
═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import { cajasService } from '../../services/api';
import FilterBar from '../history/filterbar';
import CorteDetail from './CorteDetail';
import { LoadingState, EmptyState } from '../history/shared';
import { fmtDate, fmtTime, fmtMoney, buildDateRange } from '../history/utils';

export default function CortesSection({ mobileView, setMobileView, onBack }) {
    const [cortes,      setCortes]      = useState([]);
    const [selected,    setSelected]    = useState(null);
    const [loading,     setLoading]     = useState(false);
    const [filter,      setFilter]      = useState('month');
    const [search,      setSearch]      = useState('');
    const [customRange, setCustomRange] = useState({ from: '', to: '' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await cajasService.getCortes();
            setCortes(res || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* Filtrado por rango en frontend (los cortes no son muchos) */
    const applyDateFilter = (list) => {
        if (filter === 'all') return list;
        let from, to;
        if (filter === 'custom') {
            if (!customRange.from) return list;
            from = new Date(customRange.from);
            to   = customRange.to ? new Date(customRange.to + 'T23:59:59') : new Date();
        } else {
            const range = buildDateRange(filter);
            from = range.from ? new Date(range.from) : null;
            to   = range.to   ? new Date(range.to)   : null;
        }
        return list.filter(c => {
            const d = new Date(c.created_at);
            if (from && d < from) return false;
            if (to   && d > to)   return false;
            return true;
        });
    };

    const filtered = applyDateFilter(cortes).filter(c =>
        !search ||
        c.folio?.toLowerCase().includes(search.toLowerCase()) ||
        c.caja_name?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex-1 flex overflow-hidden min-h-0">

            {/* ── Lista ── */}
            <div className={`
                flex flex-col border-r border-outline-variant/30 bg-surface-bright
                w-full md:w-[360px] md:flex shrink-0
                ${mobileView === 'detail' ? 'hidden md:flex' : 'flex'}
            `}>
                <FilterBar
                    title="Cortes de caja"
                    filter={filter}       setFilter={setFilter}
                    search={search}       setSearch={setSearch}
                    placeholder="Buscar por folio o caja..."
                    customRange={customRange} setCustomRange={setCustomRange}
                    onBack={onBack}
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <EmptyState label="No hay cortes en este período" />
                    ) : (
                        filtered.map(corte => (
                            <button
                                key={corte.id}
                                onClick={() => { setSelected(corte); setMobileView('detail'); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 text-left transition-colors hover:bg-surface-container-low ${
                                    selected?.id === corte.id
                                        ? 'bg-secondary/5 border-l-2 border-l-secondary'
                                        : ''
                                }`}
                            >
                                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                                    <span
                                        className="material-symbols-outlined text-[18px]"
                                        style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                        point_of_sale
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-[13px] text-on-surface font-mono">
                                            {corte.folio}
                                        </span>
                                        <span className="font-bold text-[13px] text-secondary shrink-0">
                                            {fmtMoney(corte.total_amount)}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-on-surface-variant">
                                        {corte.caja_name || '—'} · {fmtDate(corte.created_at)}
                                    </p>
                                    <p className="text-[10px] text-on-surface-variant/70">
                                        {corte.sales_count} ventas
                                    </p>
                                </div>
                                <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                                    chevron_right
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* ── Detalle ── */}
            <div className={`
                flex-1 flex flex-col overflow-hidden bg-slate-50
                ${mobileView === 'list' ? 'hidden md:flex' : 'flex'}
            `}>
                {!selected ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-4 text-on-surface-variant">
                        <span className="material-symbols-outlined text-[64px] text-outline-variant">
                            point_of_sale
                        </span>
                        <p className="text-lg font-medium">
                            Selecciona un corte para ver el detalle
                        </p>
                    </div>
                ) : (
                    <CorteDetail
                        corte={selected}
                        onBack={() => { setMobileView('list'); setSelected(null); }}
                    />
                )}
            </div>
        </div>
    );
}