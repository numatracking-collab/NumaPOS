/* ═══════════════════════════════════════════════════════════════════════════
   AdjustmentDetail.jsx — Detalle de ajuste de inventario
═══════════════════════════════════════════════════════════════════════════ */

import { Row } from '../history/shared';
import { fmtDate, fmtTime } from '../history/utils';

export default function AdjustmentDetail({ adj, onBack }) {
    const isIn = adj.type === 'IN';

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
                    <p className="font-black text-[16px] text-on-surface">Detalle de ajuste</p>
                    <p className="text-[11px] text-on-surface-variant">
                        {fmtDate(adj.created_at)} · {fmtTime(adj.created_at)}
                    </p>
                </div>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">
                <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-3">

                    {/* Tipo + razón */}
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[18px] ${
                            isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {isIn ? `+${adj.quantity}` : `-${adj.quantity}`}
                        </div>
                        <div>
                            <p className="font-bold text-[15px] text-on-surface">
                                {isIn ? 'Entrada' : 'Salida'}
                            </p>
                            <p className="text-[12px] text-on-surface-variant capitalize">{adj.reason}</p>
                        </div>
                    </div>

                    {/* Datos */}
                    <div className="border-t border-outline-variant/20 pt-3 flex flex-col gap-2">
                        <Row label="Producto" value={adj.product_name || '—'} />
                        <Row label="SKU"      value={adj.product_sku  || '—'} mono />
                        <Row label="Cajero"   value={adj.user_name    || '—'} />
                        <Row
                            label="Fecha"
                            value={`${fmtDate(adj.created_at)} ${fmtTime(adj.created_at)}`}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}