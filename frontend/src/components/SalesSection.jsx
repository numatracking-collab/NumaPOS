/* ═══════════════════════════════════════════════════════════════════════════
   SalesSection.jsx — Panel de lista de ventas
═══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from 'react';
import { salesService } from '../services/api';
import FilterBar from './history/filterbar';
import SaleDetail from './SaleDetail';
import { LoadingState, EmptyState } from './history/shared';
import { fmtDate, fmtTime, fmtMoney, METHOD_LABEL, METHOD_COLOR, buildDateRange } from './history/utils';

export default function SalesSection({ mobileView, setMobileView, onBack }) {
    const [sales, setSales] = useState([]);
    const [selected, setSelected] = useState(null);
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(false);
    const [detailLoad, setDetailLoad] = useState(false);
    const [filter, setFilter] = useState('today');
    const [search, setSearch] = useState('');
    const [customRange, setCustomRange] = useState({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);

    const fetchSales = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 30 };
            if (filter !== 'all' && filter !== 'custom') {
                const range = buildDateRange(filter);
                if (range.from) params.from = range.from;
                if (range.to) params.to = range.to;
            } else if (filter === 'custom' && customRange.from) {
                params.from = new Date(customRange.from).toISOString();
                if (customRange.to)
                    params.to = new Date(customRange.to + 'T23:59:59').toISOString();
            }
            const res = await salesService.list(params);
            setSales(res.data || []);
            setPagination(res.pagination);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filter, customRange, page]);

    useEffect(() => { setPage(1); }, [filter, customRange]);
    useEffect(() => { fetchSales(); }, [fetchSales]);

    const handleSelectSale = async (sale) => {
        setSelected(sale);
        setDetailLoad(true);
        setMobileView('detail');
        try {
            const res = await salesService.get(sale.id);
            setDetail(res);
        } catch (err) {
            console.error(err);
        } finally {
            setDetailLoad(false);
        }
    };

    const filtered = sales.filter(s =>
        !search || s.folio?.toLowerCase().includes(search.toLowerCase())
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
                    title="Ventas"
                    filter={filter} setFilter={setFilter}
                    search={search} setSearch={setSearch}
                    placeholder="Buscar por folio..."
                    customRange={customRange} setCustomRange={setCustomRange}
                    onBack={onBack}
                />

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <EmptyState label="No hay ventas en este período" />
                    ) : (
                        filtered.map(sale => (
                            <button
                                key={sale.id}
                                onClick={() => handleSelectSale(sale)}
                                className={`w-full flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 text-left transition-colors hover:bg-surface-container-low ${selected?.id === sale.id
                                        ? 'bg-secondary/5 border-l-2 border-l-secondary'
                                        : ''
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-[13px] text-on-surface font-mono">
                                            {sale.folio}
                                        </span>
                                        <span className="font-bold text-[13px] text-secondary shrink-0">
                                            {fmtMoney(sale.total_amount)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${METHOD_COLOR[sale.payment_method] || 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {METHOD_LABEL[sale.payment_method] || sale.payment_method}
                                        </span>
                                        <span className="text-[11px] text-on-surface-variant">
                                            {fmtDate(sale.created_at)} · {fmtTime(sale.created_at)}
                                        </span>
                                    </div>
                                    {sale.caja_name && (
                                        <span className="text-[10px] text-on-surface-variant/70">
                                            {sale.caja_name}
                                        </span>
                                    )}
                                </div>
                                <span className="material-symbols-outlined text-[18px] text-on-surface-variant shrink-0">
                                    chevron_right
                                </span>
                            </button>
                        ))
                    )}

                    {/* Paginación */}
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
                            receipt_long
                        </span>
                        <p className="text-lg font-medium">
                            Selecciona una venta para ver el detalle
                        </p>
                    </div>
                ) : detailLoad ? (
                    <LoadingState />
                ) : detail ? (
                    <SaleDetail
                        sale={detail} // ✅ Pasamos 'detail' directamente porque ya contiene el folio, total, etc.
                        items={detail.items}
                        onBack={() => { setMobileView('list'); setSelected(null); }}
                    />
                ) : null}
            </div>
        </div>
    );
}