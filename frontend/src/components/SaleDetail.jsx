/* ═══════════════════════════════════════════════════════════════════════════
   SaleDetail.jsx — Detalle de venta con protección asíncrona contra undefined
═══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { reprintSaleTicket } from './../services/printerService';
import { PrintStatusBadge } from './history/shared';
import { fmtDate, fmtTime, fmtMoney, METHOD_LABEL, METHOD_COLOR } from './history/utils';

export default function SaleDetail({ sale, items = [], onBack }) {
    const [printStatus, setPrintStatus] = useState('idle'); // idle|printing|ok|error|skipped
    const [printError,  setPrintError]  = useState('');

    const handleReprint = async () => {
        if (!sale) return; // Evita interactuar si no hay venta cargada
        setPrintStatus('printing');
        setPrintError('');

        const result = await reprintSaleTicket(sale, items);

        if (result.ok) {
            setPrintStatus('ok');
            setTimeout(() => setPrintStatus('idle'), 4000);
        } else if (result.error === 'No hay impresora con impresión automática habilitada.') {
            setPrintStatus('skipped');
        } else {
            setPrintStatus('error');
            setPrintError(result.error);
        }
    };

    /* ── 1. CLÁUSULA DE GUARDA CRÍTICA ── */
    // Si la venta aún se está recuperando de la API local, muestra un estado limpio de carga
    if (!sale) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-on-surface-variant bg-surface-container-low">
                <span className="material-symbols-outlined text-[32px] animate-spin mb-2">sync</span>
                <p className="text-[14px] font-medium">Cargando detalles de la venta...</p>
            </div>
        );
    }

    /* ── Ícono y label del botón según estado ── */
    const reprintIcon = {
        idle:     'print',
        printing: 'autorenew',
        ok:       'check_circle',
        error:    'print_disabled',
        skipped:  'print',
    }[printStatus] ?? 'print';

    const reprintLabel = {
        idle:     'Reimprimir',
        printing: 'Imprimiendo...',
        ok:       'Impreso',
        error:    'Error',
        skipped:  'Reimprimir',
    }[printStatus] ?? 'Reimprimir';

    const reprintColorCls = {
        ok:    'text-emerald-600',
        error: 'text-error',
    }[printStatus] ?? 'text-on-surface';

    return (
        <div className="flex-1 flex flex-col overflow-hidden">

            {/* ── Header ── */}
            <div className="shrink-0 bg-surface-bright border-b border-outline-variant/30 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="md:hidden w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                            arrow_back
                        </span>
                    </button>
                    <div>
                        {/* ✅ Ahora es 100% seguro acceder a las propiedades */}
                        <p className="font-black text-[16px] text-on-surface font-mono">{sale.folio}</p>
                        <p className="text-[11px] text-on-surface-variant">
                            {fmtDate(sale.created_at)} · {fmtTime(sale.created_at)}
                        </p>
                    </div>
                </div>

                {/* Botón Reimprimir */}
                <button
                    onClick={handleReprint}
                    disabled={printStatus === 'printing'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-[12px] font-medium hover:bg-surface-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className={`material-symbols-outlined text-[16px] ${reprintColorCls} ${
                        printStatus === 'printing' ? 'animate-spin' : ''
                    }`}>
                        {reprintIcon}
                    </span>
                    <span className={reprintColorCls}>{reprintLabel}</span>
                </button>
            </div>

            {/* ── Contenido ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">

                {printStatus !== 'idle' && printStatus !== 'skipped' && (
                    <PrintStatusBadge status={printStatus} error={printError} />
                )}

                {printStatus === 'skipped' && (
                    <div className="flex items-start gap-2 rounded-xl border border-outline-variant/40 px-3 py-2.5 text-[12px] text-on-surface-variant bg-surface-container-low">
                        <span className="material-symbols-outlined text-[16px] shrink-0 mt-px">info</span>
                        <span>
                            No hay impresora con auto-impresión habilitada.
                            Configúrala en <strong>Ajustes → Dispositivos</strong>.
                        </span>
                    </div>
                )}

                {/* Resumen de pago */}
                <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wide">
                            Método de pago
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            METHOD_COLOR[sale.payment_method] || 'bg-slate-100 text-slate-600'
                        }`}>
                            {METHOD_LABEL[sale.payment_method] || sale.payment_method}
                        </span>
                    </div>
                    {sale.caja_name && (
                        <div className="flex items-center justify-between">
                            <span className="text-[12px] text-on-surface-variant">Caja</span>
                            <span className="text-[12px] font-medium text-on-surface">{sale.caja_name}</span>
                        </div>
                    )}
                </div>

                {/* Productos */}
                <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 overflow-hidden">
                    <div className="px-4 py-3 border-b border-outline-variant/20">
                        <p className="font-bold text-[13px] text-on-surface">Productos</p>
                    </div>
                    {/* ✅ Se añade un fallback (items || []) implícito en los parámetros para prevenir fallos */}
                    {items && items.map((item, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/10 last:border-none"
                        >
                            <div className="w-10 h-10 rounded-lg bg-surface-container-low border border-outline-variant/30 overflow-hidden shrink-0 flex items-center justify-center">
                                {item.image_url
                                    ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                    : <span className="material-symbols-outlined text-[16px] text-outline">image</span>
                                }
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-medium text-on-surface truncate">{item.name || item.product_name}</p>
                                <p className="text-[11px] text-on-surface-variant font-mono">
                                    {item.sku || '—'} · {item.quantity} × {fmtMoney(item.unit_price)}
                                </p>
                            </div>
                            <span className="font-bold text-[13px] text-secondary shrink-0">
                                {fmtMoney(item.subtotal)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Totales */}
                <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-2">
                    <div className="flex justify-between text-[13px] text-on-surface-variant">
                        <span>Subtotal</span>
                        <span>{fmtMoney(sale.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-[13px] text-on-surface-variant">
                        <span>Impuesto</span>
                        <span>{fmtMoney(sale.tax_amount)}</span>
                    </div>
                    <div className="flex justify-between font-black text-[16px] text-on-surface border-t border-outline-variant/20 pt-2 mt-1">
                        <span>Total</span>
                        <span className="text-secondary">{fmtMoney(sale.total_amount)}</span>
                    </div>
                </div>

            </div>
        </div>
    );
}