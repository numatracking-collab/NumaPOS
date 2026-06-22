/* ═══════════════════════════════════════════════════════════════════════════
   CorteDetail.jsx — Detalle de corte de caja
   ───────────────────────────────────────────────────────────────────────────
   CAMBIOS vs versión anterior:
   • Muestra prev_balance como línea separada antes de "Ventas del sistema"
     para que el cajero entienda de dónde sale el efectivo esperado total.
   • Carga la bitácora detallada (GET /cortes/:id/detail) al abrir el detalle,
     mostrando dos listas cronológicas independientes: efectivo y tarjeta,
     cada una con saldo corriente, hora y usuario por evento.
   • El cálculo de diff_cash en la UI ahora siempre cuadra con lo que el
     backend guardó porque ambos usan la misma base (expected = prev_balance
     + ventas + movimientos - cancelaciones).
═══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect } from 'react';
import { Row, LoadingState } from '../history/shared';
import { fmtDate, fmtTime, fmtMoney } from '../history/utils';
import { cajasService } from '../../services/api';

/* ── Indicador de diferencia ──────────────────────────────────────────── */
function DiffBadge({ diff }) {
    const n = Number(diff ?? 0);
    if (Math.abs(n) < 0.005) {
        return (
            <span className="text-[12px] font-bold text-emerald-600 flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Cuadra exacto
            </span>
        );
    }
    const sobrante = n > 0;
    return (
        <span className={`text-[12px] font-bold flex items-center gap-0.5 ${sobrante ? 'text-emerald-600' : 'text-red-600'}`}>
            <span className="material-symbols-outlined text-[14px]">
                {sobrante ? 'arrow_upward' : 'arrow_downward'}
            </span>
            {sobrante ? '+' : '−'}{fmtMoney(Math.abs(n))} {sobrante ? 'sobrante' : 'faltante'}
        </span>
    );
}

/* ── Fila label / valor ───────────────────────────────────────────────── */
function DetailRow({ label, value, valueClass = '' }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[13px] text-on-surface-variant">{label}</span>
            <span className={`text-[13px] font-semibold text-on-surface ${valueClass}`}>{value}</span>
        </div>
    );
}

/* ── Íconos y colores por categoría de evento ─────────────────────────── */
const EVENT_META = {
    venta:      { icon: 'shopping_cart', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    cancelacion:{ icon: 'remove_shopping_cart', color: 'text-red-500',   bg: 'bg-red-50'     },
    movimiento: { icon: 'swap_vert',     color: 'text-blue-500',   bg: 'bg-blue-50'    },
};

/* ── Fila de evento en la bitácora ────────────────────────────────────── */
function LedgerRow({ event }) {
    const meta  = EVENT_META[event.category] ?? EVENT_META.movimiento;
    const isIn  = event.type === 'in';

    return (
        <div className="flex items-center gap-3 py-2.5 border-b border-outline-variant/20 last:border-0">
            {/* Ícono categoría */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                <span className={`material-symbols-outlined text-[14px] ${meta.color}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {meta.icon}
                </span>
            </div>

            {/* Descripción + hora + usuario */}
            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-on-surface truncate">{event.label}</p>
                <p className="text-[10px] text-on-surface-variant/70 mt-0.5">
                    {fmtTime(event.at)}
                    {event.user_name ? ` · ${event.user_name}` : ''}
                </p>
            </div>

            {/* Monto + saldo corriente */}
            <div className="flex flex-col items-end shrink-0">
                <span className={`text-[12px] font-bold ${isIn ? 'text-emerald-600' : 'text-red-500'}`}>
                    {isIn ? '+' : '−'}{fmtMoney(event.amount)}
                </span>
                <span className="text-[10px] text-on-surface-variant font-mono">
                    = {fmtMoney(event.running_balance)}
                </span>
            </div>
        </div>
    );
}

/* ── Bitácora completa (efectivo o tarjeta) ───────────────────────────── */
function Ledger({ title, icon, events, openingBalance, loading }) {
    if (loading) {
        return (
            <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4">
                <p className="font-bold text-[13px] text-on-surface mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-secondary">{icon}</span>
                    {title}
                </p>
                <div className="flex items-center justify-center py-6 text-on-surface-variant/50 gap-2">
                    <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                    <span className="text-[12px]">Cargando bitácora…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4">
            {/* Header de la bitácora */}
            <p className="font-bold text-[13px] text-on-surface mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-secondary"
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {icon}
                </span>
                {title}
            </p>

            {/* Saldo inicial (solo efectivo, donde prev_balance puede ser > 0) */}
            {openingBalance > 0 && (
                <div className="flex items-center justify-between py-2 mb-1 border-b border-outline-variant/30">
                    <span className="text-[11px] text-on-surface-variant italic">Saldo inicial (corte anterior)</span>
                    <span className="text-[11px] font-mono text-on-surface-variant">{fmtMoney(openingBalance)}</span>
                </div>
            )}

            {/* Eventos */}
            {events.length === 0 ? (
                <p className="text-[12px] text-on-surface-variant/50 text-center py-4">
                    Sin movimientos en este período
                </p>
            ) : (
                <div>
                    {events.map((e, i) => <LedgerRow key={`${e.ref_id}-${i}`} event={e} />)}
                </div>
            )}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   CorteDetail
══════════════════════════════════════════════════════════════════════════ */
export default function CorteDetail({ corte, onBack }) {
    const [detail, setDetail]       = useState(null);
    const [loadingDetail, setLoading] = useState(false);
    const [detailError, setDetailError] = useState('');

    // Carga la bitácora detallada al montar o al cambiar de corte
    useEffect(() => {
        if (!corte?.id) return;
        setDetail(null);
        setDetailError('');
        setLoading(true);

        cajasService.getCorteDetail(corte.id)
            .then(data => setDetail(data))
            .catch(err => setDetailError(err.message))
            .finally(() => setLoading(false));
    }, [corte?.id]);

    if (!corte) return null;

    const hasConteo   = Number(corte.counted_cash ?? 0) > 0 || Number(corte.counted_card ?? 0) > 0;
    const prevBalance = Number(corte.prev_balance ?? 0);

    // Efectivo esperado reconstruido en el frontend para mostrarlo claramente:
    // debe coincidir con lo que el backend guardó en diff_cash.
    const expectedCash = prevBalance
        + Number(corte.total_cash ?? 0)
        + Number(corte.movements_in ?? 0)
        - Number(corte.movements_out ?? 0);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── Header ── */}
            <div className="shrink-0 bg-surface-bright border-b border-outline-variant/30 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="md:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">arrow_back</span>
                </button>
                <div>
                    <p className="font-black text-[16px] text-on-surface font-mono">{corte.folio}</p>
                    <p className="text-[11px] text-on-surface-variant">
                        {corte.caja_name} · {fmtDate(corte.created_at)} {fmtTime(corte.created_at)}
                    </p>
                </div>
            </div>

            {/* ── Contenido ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">

                {/* ── Total del corte ── */}
                <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                        <p className="text-[12px] font-semibold text-secondary uppercase tracking-wide">
                            Total del corte
                        </p>
                        <p className="text-[32px] font-black text-secondary">
                            {fmtMoney(corte.total_amount)}
                        </p>
                        <p className="text-[12px] text-on-surface-variant">
                            {corte.sales_count} ventas incluidas
                        </p>
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-secondary/20 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[28px] text-secondary"
                            style={{ fontVariationSettings: "'FILL' 1" }}>
                            point_of_sale
                        </span>
                    </div>
                </div>

                {/* ── Desglose de efectivo esperado ── */}
                <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-2">
                    <p className="font-bold text-[13px] text-on-surface mb-1">Ventas del sistema</p>

                    {/* Saldo del corte anterior — solo si es relevante (> 0) */}
                    {prevBalance > 0 && (
                        <>
                            <DetailRow
                                label="Saldo del corte anterior"
                                value={fmtMoney(prevBalance)}
                                valueClass="text-secondary"
                            />
                            <div className="border-t border-outline-variant/20 my-0.5" />
                        </>
                    )}

                    <Row label="Efectivo"      value={fmtMoney(corte.total_cash)} />
                    <Row label="Tarjeta"       value={fmtMoney(corte.total_card)} />
                    <Row label="Transferencia" value={fmtMoney(corte.total_transfer)} />

                    {/* Movimientos de caja — solo si los hubo */}
                    {(Number(corte.movements_in) > 0 || Number(corte.movements_out) > 0) && (
                        <>
                            <div className="border-t border-outline-variant/20 my-0.5" />
                            {Number(corte.movements_in) > 0 && (
                                <DetailRow
                                    label="Entradas manuales"
                                    value={`+${fmtMoney(corte.movements_in)}`}
                                    valueClass="text-emerald-600"
                                />
                            )}
                            {Number(corte.movements_out) > 0 && (
                                <DetailRow
                                    label="Salidas manuales"
                                    value={`−${fmtMoney(corte.movements_out)}`}
                                    valueClass="text-red-500"
                                />
                            )}
                        </>
                    )}

                    {/* Efectivo esperado total — solo si prev_balance o movimientos suman algo relevante */}
                    {(prevBalance > 0 || Number(corte.movements_in) > 0 || Number(corte.movements_out) > 0) && (
                        <>
                            <div className="border-t border-outline-variant/30 mt-1 mb-0.5" />
                            <DetailRow
                                label="Efectivo esperado en caja"
                                value={fmtMoney(expectedCash)}
                                valueClass="font-black text-on-surface"
                            />
                        </>
                    )}
                </div>

                {/* ── Conteo del cajero + diferencias ── */}
                {hasConteo && (
                    <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-3">
                        <p className="font-bold text-[13px] text-on-surface">Conteo del cajero</p>

                        {/* Efectivo */}
                        <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between items-center">
                                <span className="text-[13px] text-on-surface-variant flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">payments</span>
                                    Efectivo contado
                                </span>
                                <span className="text-[13px] font-semibold">{fmtMoney(corte.counted_cash)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-on-surface-variant/60">
                                <span>Esperado: {fmtMoney(expectedCash)}</span>
                                <DiffBadge diff={corte.diff_cash} />
                            </div>
                        </div>

                        <div className="border-t border-outline-variant/10" />

                        {/* Tarjeta */}
                        <div className="flex flex-col gap-0.5">
                            <div className="flex justify-between items-center">
                                <span className="text-[13px] text-on-surface-variant flex items-center gap-1">
                                    <span className="material-symbols-outlined text-[14px]">credit_card</span>
                                    Tarjeta contada
                                </span>
                                <span className="text-[13px] font-semibold">{fmtMoney(corte.counted_card)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-on-surface-variant/60">
                                <span>Esperado: {fmtMoney(corte.total_card)}</span>
                                <DiffBadge diff={corte.diff_card} />
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Saldo para siguiente turno ── */}
                {Number(corte.leave_balance ?? 0) > 0 && (
                    <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-secondary">savings</span>
                            <p className="text-[13px] text-on-surface">Saldo para siguiente turno</p>
                        </div>
                        <p className="font-black text-[15px] text-secondary">
                            {fmtMoney(corte.leave_balance)}
                        </p>
                    </div>
                )}

                {/* ── Período cubierto ── */}
                {(corte.sales_from || corte.sales_to) && (
                    <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-2">
                        <p className="font-bold text-[13px] text-on-surface mb-1">Período cubierto</p>
                        {corte.sales_from && (
                            <Row label="Desde" value={`${fmtDate(corte.sales_from)} ${fmtTime(corte.sales_from)}`} />
                        )}
                        {corte.sales_to && (
                            <Row label="Hasta" value={`${fmtDate(corte.sales_to)} ${fmtTime(corte.sales_to)}`} />
                        )}
                    </div>
                )}

                {/* ── Bitácora detallada — efectivo ── */}
                {detailError ? (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-[12px] text-red-600">
                        No se pudo cargar la bitácora: {detailError}
                    </div>
                ) : (
                    <>
                        <Ledger
                            title="Bitácora de efectivo"
                            icon="payments"
                            loading={loadingDetail}
                            openingBalance={detail?.opening_cash_balance ?? 0}
                            events={detail?.cash_ledger ?? []}
                        />

                        <Ledger
                            title="Bitácora de tarjeta"
                            icon="credit_card"
                            loading={loadingDetail}
                            openingBalance={0}
                            events={detail?.card_ledger ?? []}
                        />
                    </>
                )}

                {/* ── Notas ── */}
                {corte.notes && (
                    <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4">
                        <p className="font-bold text-[13px] text-on-surface mb-1">Notas</p>
                        <p className="text-[13px] text-on-surface-variant leading-relaxed">{corte.notes}</p>
                    </div>
                )}

                <div className="h-4" aria-hidden="true" />
            </div>
        </div>
    );
}