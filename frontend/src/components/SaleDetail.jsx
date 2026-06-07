/* ═══════════════════════════════════════════════════════════════════════════
   SaleDetail.jsx — Detalle de venta
   • Usa salesService (api.js) para cancelar → mismo token que toda la app
   • Modal de cancelación extraído a CancelSaleModal.jsx
   • Imágenes de productos desde Cloudinary con fallback
   • Etiqueta visual de venta cancelada
   • Accesibilidad mejorada para adultos no técnicos
═══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';
import { salesService }      from '../services/api';
import { reprintSaleTicket } from '../services/printerService';
import { PrintStatusBadge }  from './history/shared';
import CancelSaleModal       from './CancelSaleModal';
import {
    fmtDate, fmtTime, fmtMoney,
    METHOD_LABEL, METHOD_COLOR,
} from './history/utils';

/* ─────────────────────────────────────────────────────────────────────────
   Componente principal
───────────────────────────────────────────────────────────────────────── */
export default function SaleDetail({
    sale: initialSale,
    items = [],
    onBack,
    onSaleCancelled,   // (saleId) => void  — para que el padre actualice su lista
}) {
    // Estado local de la venta: permite reflejar la cancelación
    // sin necesidad de recargar la página ni el componente padre.
    const [sale, setSale] = useState(initialSale);

    // ── Impresión ─────────────────────────────────────────────────────────
    const [printStatus, setPrintStatus] = useState('idle'); // idle|printing|ok|error|skipped
    const [printError,  setPrintError]  = useState('');

    // ── Cancelación ───────────────────────────────────────────────────────
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelLoading,   setCancelLoading]   = useState(false);
    const [cancelError,     setCancelError]     = useState('');

    const isCancelled = sale?.status === 'cancelled';

    // ── Reimprimir ticket ─────────────────────────────────────────────────
    const handleReprint = async () => {
        if (!sale) return;
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

    // ── Confirmar cancelación ─────────────────────────────────────────────
    const handleCancelConfirm = async (reason) => {
        setCancelLoading(true);
        setCancelError('');
        try {
            // salesService usa request() → mismo token (sessionStorage 'numa_token')
            // que el resto de la aplicación. No hay fetch manual.
            await salesService.cancel(sale.id, reason);

            // Actualiza estado local para mostrar etiqueta sin recargar
            setSale(prev => ({
                ...prev,
                status:       'cancelled',
                cancelled_at: new Date().toISOString(),
            }));

            setShowCancelModal(false);

            // Notifica al padre (HistoryPanel, etc.) para que marque la venta
            // como cancelada en su lista sin volver a hacer fetch.
            if (typeof onSaleCancelled === 'function') onSaleCancelled(sale.id);

        } catch (err) {
            setCancelError(err.message || 'No se pudo cancelar la venta.');
        } finally {
            setCancelLoading(false);
        }
    };

    // ── Estado de carga ───────────────────────────────────────────────────
    if (!sale) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-on-surface-variant bg-surface-container-low">
                <span className="material-symbols-outlined text-[40px] animate-spin mb-3" aria-hidden="true">
                    sync
                </span>
                <p className="text-[15px] font-semibold">Cargando los datos de la venta…</p>
                <p className="text-[12px] mt-1 text-on-surface-variant/70">Un momento, por favor.</p>
            </div>
        );
    }

    // ── Config. visual del botón reimprimir ───────────────────────────────
    const reprintIcon = {
        idle:     'print',
        printing: 'autorenew',
        ok:       'check_circle',
        error:    'print_disabled',
        skipped:  'print',
    }[printStatus] ?? 'print';

    const reprintLabel = {
        idle:     'Reimprimir ticket',
        printing: 'Imprimiendo…',
        ok:       'Ticket enviado',
        error:    'Error al imprimir',
        skipped:  'Reimprimir ticket',
    }[printStatus] ?? 'Reimprimir ticket';

    const reprintColorCls = {
        ok:    'text-emerald-600',
        error: 'text-error',
    }[printStatus] ?? 'text-on-surface';

    /* ══════════════════════════════════════════════════════════════════════
       Render
    ══════════════════════════════════════════════════════════════════════ */
    return (
        <>
            {/* ── Modal de cancelación (portal independiente) ────────────── */}
            {showCancelModal && (
                <CancelSaleModal
                    folio={sale.folio}
                    loading={cancelLoading}
                    error={cancelError}
                    onConfirm={handleCancelConfirm}
                    onClose={() => {
                        setShowCancelModal(false);
                        setCancelError('');
                    }}
                />
            )}

            <div className="flex-1 flex flex-col overflow-hidden">

                {/* ══════════════════════════════════════════════════════════
                    HEADER
                ══════════════════════════════════════════════════════════ */}
                <div className="shrink-0 bg-surface-bright border-b border-outline-variant/30 px-4 py-3">

                    {/* Fila: back + folio + botones */}
                    <div className="flex items-center justify-between gap-2">

                        {/* Botón volver + folio */}
                        <div className="flex items-center gap-2 min-w-0">
                            <button
                                onClick={onBack}
                                aria-label="Volver al historial de ventas"
                                className="md:hidden w-9 h-9 rounded-full flex items-center justify-center
                                           hover:bg-surface-container transition-colors shrink-0"
                            >
                                <span className="material-symbols-outlined text-[22px] text-on-surface-variant" aria-hidden="true">
                                    arrow_back
                                </span>
                            </button>
                            <div className="min-w-0">
                                <p className="font-black text-[17px] text-on-surface font-mono leading-tight">
                                    {sale.folio}
                                </p>
                                <p className="text-[12px] text-on-surface-variant">
                                    {fmtDate(sale.created_at)} · {fmtTime(sale.created_at)}
                                </p>
                            </div>
                        </div>

                        {/* Acciones: Reimprimir + Cancelar */}
                        <div className="flex items-center gap-2 shrink-0">

                            {/* Reimprimir */}
                            <button
                                onClick={handleReprint}
                                disabled={printStatus === 'printing'}
                                aria-label="Reimprimir el ticket de esta venta"
                                title="Reimprimir ticket"
                                className="
                                    flex items-center gap-1.5 px-3 py-2 rounded-xl
                                    bg-surface-container-low border border-outline-variant
                                    text-[12px] font-semibold
                                    hover:bg-surface-container transition-colors
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                "
                            >
                                <span
                                    className={`material-symbols-outlined text-[16px] ${reprintColorCls} ${
                                        printStatus === 'printing' ? 'animate-spin' : ''
                                    }`}
                                    aria-hidden="true"
                                >
                                    {reprintIcon}
                                </span>
                                <span className={`hidden sm:inline ${reprintColorCls}`}>
                                    {reprintLabel}
                                </span>
                            </button>

                            {/* Cancelar — solo si la venta está activa */}
                            {!isCancelled && (
                                <button
                                    onClick={() => setShowCancelModal(true)}
                                    aria-label="Cancelar esta venta"
                                    title="Cancelar venta"
                                    className="
                                        flex items-center gap-1.5 px-3 py-2 rounded-xl
                                        bg-error/8 border border-error/25 text-error
                                        text-[12px] font-semibold
                                        hover:bg-error/15 hover:border-error/40
                                        active:scale-[0.97] transition-all
                                    "
                                >
                                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                                        cancel
                                    </span>
                                    <span className="hidden sm:inline">Cancelar venta</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Etiqueta CANCELADA — clara y prominente en el header */}
                    {isCancelled && (
                        <div
                            role="status"
                            aria-live="polite"
                            className="mt-3 flex items-center gap-2 rounded-xl bg-error/10 border border-error/30 px-3 py-2.5"
                        >
                            <span className="material-symbols-outlined text-[18px] text-error shrink-0" aria-hidden="true">
                                do_not_disturb_on
                            </span>
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-error leading-tight">
                                    Venta cancelada
                                </p>
                                {sale.cancelled_at && (
                                    <p className="text-[11px] text-error/70">
                                        {fmtDate(sale.cancelled_at)} · {fmtTime(sale.cancelled_at)}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ══════════════════════════════════════════════════════════
                    CONTENIDO
                ══════════════════════════════════════════════════════════ */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4">

                    {/* Estado de impresión */}
                    {printStatus !== 'idle' && printStatus !== 'skipped' && (
                        <PrintStatusBadge status={printStatus} error={printError} />
                    )}
                    {printStatus === 'skipped' && (
                        <div className="flex items-start gap-2 rounded-xl border border-outline-variant/40 px-3 py-2.5 text-[13px] text-on-surface-variant bg-surface-container-low">
                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-px" aria-hidden="true">
                                info
                            </span>
                            <span>
                                No hay impresora con auto-impresión habilitada.
                                Configúrala en <strong>Ajustes → Dispositivos</strong>.
                            </span>
                        </div>
                    )}

                    {/* ── Resumen de pago ─────────────────────────────────── */}
                    <section
                        aria-label="Información de pago"
                        className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-3"
                    >
                        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest">
                            Método de pago
                        </h3>
                        <div className="flex items-center justify-between">
                            <span className="text-[14px] text-on-surface">Forma de cobro</span>
                            <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${
                                METHOD_COLOR[sale.payment_method] || 'bg-slate-100 text-slate-600'
                            }`}>
                                {METHOD_LABEL[sale.payment_method] || sale.payment_method}
                            </span>
                        </div>
                        {sale.caja_name && (
                            <div className="flex items-center justify-between">
                                <span className="text-[14px] text-on-surface">Caja</span>
                                <span className="text-[14px] font-semibold text-on-surface">
                                    {sale.caja_name}
                                </span>
                            </div>
                        )}
                    </section>

                    {/* ── Productos ──────────────────────────────────────── */}
                    <section aria-label="Productos de esta venta">
                        <div className="bg-surface-bright rounded-2xl border border-outline-variant/30 overflow-hidden">

                            <div className="px-4 py-3 border-b border-outline-variant/20">
                                <h3 className="font-bold text-[14px] text-on-surface">
                                    Productos vendidos
                                </h3>
                                <p className="text-[11px] text-on-surface-variant mt-0.5">
                                    {items.length}{' '}
                                    {items.length === 1 ? 'artículo' : 'artículos'}
                                </p>
                            </div>

                            {items.map((item, idx) => (
                                <div
                                    key={item.id ?? idx}
                                    className="flex items-center gap-3 px-4 py-3.5 border-b border-outline-variant/10 last:border-none"
                                >
                                    {/* Imagen del producto */}
                                    <div className="w-12 h-12 rounded-xl bg-surface-container-low border border-outline-variant/30 overflow-hidden shrink-0 flex items-center justify-center">
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt={item.product_name || item.name || 'Producto'}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                onError={e => {
                                                    e.currentTarget.style.display = 'none';
                                                    e.currentTarget.parentElement
                                                        ?.querySelector('[data-fallback]')
                                                        ?.removeAttribute('hidden');
                                                }}
                                            />
                                        ) : null}
                                        <span
                                            data-fallback
                                            className="material-symbols-outlined text-[20px] text-outline"
                                            aria-hidden="true"
                                            hidden={!!item.image_url}
                                        >
                                            image
                                        </span>
                                    </div>

                                    {/* Nombre y detalle */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-semibold text-on-surface truncate">
                                            {item.product_name || item.name}
                                        </p>
                                        <p className="text-[12px] text-on-surface-variant mt-0.5">
                                            <span className="font-mono">{item.sku || '—'}</span>
                                            {' · '}
                                            {item.quantity}{' '}
                                            {item.quantity === 1 ? 'pieza' : 'piezas'}
                                            {' × '}
                                            {fmtMoney(item.unit_price)}
                                        </p>
                                    </div>

                                    {/* Subtotal */}
                                    <span
                                        className="font-black text-[15px] text-secondary shrink-0"
                                        aria-label={`Subtotal: ${fmtMoney(item.subtotal)}`}
                                    >
                                        {fmtMoney(item.subtotal)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Totales ─────────────────────────────────────────── */}
                    <section
                        aria-label="Resumen de totales"
                        className="bg-surface-bright rounded-2xl border border-outline-variant/30 p-4 flex flex-col gap-2.5"
                    >
                        <h3 className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">
                            Resumen
                        </h3>

                        <div className="flex justify-between text-[14px] text-on-surface-variant">
                            <span>Subtotal</span>
                            <span>{fmtMoney(sale.total_amount)}</span>
                        </div>
                        <div className="flex justify-between text-[14px] text-on-surface-variant">
                            <span>Impuesto</span>
                            <span>{fmtMoney(sale.tax_amount)}</span>
                        </div>

                        <div className="border-t border-outline-variant/20 pt-2.5 mt-1 flex justify-between items-baseline">
                            <span className="text-[15px] font-bold text-on-surface">Total</span>
                            <span
                                className={`font-black text-[20px] ${isCancelled ? 'text-on-surface-variant line-through' : 'text-secondary'}`}
                                aria-label={`Total: ${fmtMoney(sale.total_amount)}${isCancelled ? ', venta cancelada' : ''}`}
                            >
                                {fmtMoney(sale.total_amount)}
                            </span>
                        </div>

                        {isCancelled && (
                            <p className="text-[12px] text-error/80 text-center font-medium">
                                Este monto no se contabiliza — venta cancelada
                            </p>
                        )}
                    </section>

                    {/* Espaciado inferior para celular */}
                    <div className="h-4" aria-hidden="true" />

                </div>
            </div>
        </>
    );
}