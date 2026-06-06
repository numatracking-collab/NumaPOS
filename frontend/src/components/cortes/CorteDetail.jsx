/* ═══════════════════════════════════════════════════════════════════════════
   CorteDetail.jsx — Detalle de corte de caja
═══════════════════════════════════════════════════════════════════════════ */

import { Row } from '../history/shared';
import { fmtDate, fmtTime, fmtMoney } from '../history/utils';

export default function CorteDetail({ corte, onBack }) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden">

            {/* Header */}
            <div className="shrink-0 bg-surface-bright border-b border-outline-variant/30 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={onBack}
                    className="md:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
                >
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                        arrow_back
                    </span>
                </button>
                <div>
                    <p className="font-black text-[16px] text-on-surface font-mono">{corte.folio}</p>
                    <p className="text-[11px] text-on-surface-variant">
                        {corte.caja_name} · {fmtDate(corte.created_at)} {fmtTime(corte.created_at)}
                    </p>
                </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">

                {/* Resumen total */}
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

                {/* Desglose por método */}
                <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-2">
                    <p className="font-bold text-[13px] text-on-surface mb-1">Desglose por método</p>
                    <Row label="Efectivo"      value={fmtMoney(corte.total_cash)} />
                    <Row label="Tarjeta"       value={fmtMoney(corte.total_card)} />
                    <Row label="Transferencia" value={fmtMoney(corte.total_transfer)} />
                </div>

                {/* Período */}
                <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-2">
                    <p className="font-bold text-[13px] text-on-surface mb-1">Período cubierto</p>
                    <Row
                        label="Desde"
                        value={`${fmtDate(corte.sales_from)} ${fmtTime(corte.sales_from)}`}
                    />
                    <Row
                        label="Hasta"
                        value={`${fmtDate(corte.sales_to)} ${fmtTime(corte.sales_to)}`}
                    />
                </div>

                {corte.notes && (
                    <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4">
                        <p className="font-bold text-[13px] text-on-surface mb-1">Notas</p>
                        <p className="text-[13px] text-on-surface-variant">{corte.notes}</p>
                    </div>
                )}
            </div>
        </div>
    );
}