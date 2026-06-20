/* ═══════════════════════════════════════════════════════════════════════════
   CorteDetail.jsx — Detalle de corte de caja
   Muestra:
   • Total del período
   • Ventas por método de pago (sistema)
   • Movimientos de caja del período (si los hay)
   • Lo que contó el cajero + diferencias (si se registró conteo)
   • Saldo dejado para siguiente turno (si aplica)
   • Período cubierto
   • Notas
═══════════════════════════════════════════════════════════════════════════ */
import { Row } from '../history/shared';
import { fmtDate, fmtTime, fmtMoney } from '../history/utils';

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

/* ── Fila con etiqueta y valor ────────────────────────────────────────── */
function DetailRow({ label, value, valueClass = '' }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[13px] text-on-surface-variant">{label}</span>
            <span className={`text-[13px] font-semibold text-on-surface ${valueClass}`}>{value}</span>
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════════════════
   CorteDetail
══════════════════════════════════════════════════════════════════════════ */
export default function CorteDetail({ corte, onBack }) {
    if (!corte) return null;

    // ¿El corte incluye datos del nuevo flujo (conteo del cajero)?
    const hasConteo = Number(corte.counted_cash ?? 0) > 0 || Number(corte.counted_card ?? 0) > 0;
    const hasMovements = Number(corte.movements_in ?? 0) > 0 || Number(corte.movements_out ?? 0) > 0;

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
                        <span
                            className="material-symbols-outlined text-[28px] text-secondary"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                            point_of_sale
                        </span>
                    </div>
                </div>

                {/* ── Ventas por método (sistema) ── */}
                <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-2">
                    <p className="font-bold text-[13px] text-on-surface mb-1">Ventas del sistema</p>
                    <Row label="Efectivo"      value={fmtMoney(corte.total_cash)} />
                    <Row label="Tarjeta"       value={fmtMoney(corte.total_card)} />
                    <Row label="Transferencia" value={fmtMoney(corte.total_transfer)} />
                </div>

                {/* ── Movimientos de caja ── (solo si los hubo) */}
                {hasMovements && (
                    <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-2">
                        <p className="font-bold text-[13px] text-on-surface mb-1">Movimientos de caja</p>
                        {Number(corte.movements_in) > 0 && (
                            <DetailRow
                                label="Entradas"
                                value={`+${fmtMoney(corte.movements_in)}`}
                                valueClass="text-emerald-600"
                            />
                        )}
                        {Number(corte.movements_out) > 0 && (
                            <DetailRow
                                label="Salidas"
                                value={`−${fmtMoney(corte.movements_out)}`}
                                valueClass="text-red-600"
                            />
                        )}
                    </div>
                )}

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
                            <div className="flex justify-end">
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
                            <div className="flex justify-end">
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
                            <Row
                                label="Desde"
                                value={`${fmtDate(corte.sales_from)} ${fmtTime(corte.sales_from)}`}
                            />
                        )}
                        {corte.sales_to && (
                            <Row
                                label="Hasta"
                                value={`${fmtDate(corte.sales_to)} ${fmtTime(corte.sales_to)}`}
                            />
                        )}
                    </div>
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