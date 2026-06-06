/* ═══════════════════════════════════════════════════════════════════════════
   AdjustmentsSection.jsx — Panel de lista de ajustes de inventario
═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import { inventoryService } from './../../services/api';
import FilterBar from '../history/filterbar';
import AdjustmentDetail from './AdjustmentDetail';
import { LoadingState, EmptyState } from '../history/shared';
import { fmtDate, fmtTime, buildDateRange } from '../history/utils';

export default function AdjustmentsSection({ mobileView, setMobileView, onBack }) {
    const [items,       setItems]       = useState([]);
    const [selected,    setSelected]    = useState(null);
    const [loading,     setLoading]     = useState(false);
    const [filter,      setFilter]      = useState('today');
    const [search,      setSearch]      = useState('');
    const [customRange, setCustomRange] = useState({ from: '', to: '' });
    const [page,        setPage]        = useState(1);
    const [pagination,  setPagination]  = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 30 };
            if (filter !== 'all' && filter !== 'custom') {
                const range = buildDateRange(filter);
                if (range.from) params.from = range.from;
                if (range.to)   params.to   = range.to;
            } else if (filter === 'custom' && customRange.from) {
                params.from = new Date(customRange.from).toISOString();
                if (customRange.to)
                    params.to = new Date(customRange.to + 'T23:59:59').toISOString();
            }
            const res = await inventoryService.getAllAdjustments(params);
            setItems(res.data || []);
            setPagination(res.pagination);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filter, customRange, page]);

    useEffect(() => { setPage(1); }, [filter, customRange]);
    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = items.filter(i =>
        !search ||
        i.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        i.product_sku?.toLowerCase().includes(search.toLowerCase())
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
                    title="Ajustes de inventario"
                    filter={filter}       setFilter={setFilter}
                    search={search}       setSearch={setSearch}
                    placeholder="Buscar producto..."
                    customRange={customRange} setCustomRange={setCustomRange}
                    onBack={onBack}
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <EmptyState label="No hay ajustes en este período" />
                    ) : (
                        filtered.map(adj => (
                            <button
                                key={adj.id}
                                onClick={() => { setSelected(adj); setMobileView('detail'); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 text-left transition-colors hover:bg-surface-container-low ${
                                    selected?.id === adj.id
                                        ? 'bg-secondary/5 border-l-2 border-l-secondary'
                                        : ''
                                }`}
                            >
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-black text-[13px] ${
                                    adj.type === 'IN'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                    {adj.type === 'IN' ? `+${adj.quantity}` : `-${adj.quantity}`}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-[13px] text-on-surface truncate">
                                        {adj.product_name || 'Producto'}
                                    </p>
                                    <p className="text-[11px] text-on-surface-variant truncate">{adj.reason}</p>
                                    <p className="text-[10px] text-on-surface-variant/70">
                                        {fmtDate(adj.created_at)} · {fmtTime(adj.created_at)}
                                    </p>
                                </div>
                                <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                                    chevron_right
                                </span>
                            </button>
                        ))
                    )}

                    {pagination && pagination.pages > 1 && (
                        <div className="flex items-center justify-center gap-3 py-4">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-[12px] border border-outline-variant rounded-lg disabled:opacity-40 hover:bg-surface-container transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="text-[12px] text-on-surface-variant">
                                {page} / {pagination.pages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page === pagination.pages}
                                className="px-3 py-1.5 text-[12px] border border-outline-variant rounded-lg disabled:opacity-40 hover:bg-surface-container transition-colors"
                            >
                                Siguiente
                            </button>
                        </div>
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
                            inventory
                        </span>
                        <p className="text-lg font-medium">
                            Selecciona un ajuste para ver el detalle
                        </p>
                    </div>
                ) : (
                    <AdjustmentDetail
                        adj={selected}
                        onBack={() => { setMobileView('list'); setSelected(null); }}
                    />
                )}
            </div>
        </div>
    );
}