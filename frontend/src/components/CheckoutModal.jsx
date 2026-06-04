import { useEffect, useMemo, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { salesService, authService } from '../services/api';
import { printSaleTicket } from '../services/printerService';

/* ══════════════════════════════════════════════════════════════════════════
   CheckoutModal
   Props:
     isOpen           bool
     onClose()
     cart[]           items del carrito
     total            number
     onFinishSale()
     cashRegisterId   ID del turno de caja
     cajaId           ID de la caja física
     cajaNombre       string  nombre legible de la caja (para el ticket)
══════════════════════════════════════════════════════════════════════════ */
export default function CheckoutModal({
    isOpen,
    onClose,
    cart,
    total,
    onFinishSale,
    cashRegisterId,
    cajaId,
    cajaNombre = '',
}) {
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [amountPaid,    setAmountPaid]    = useState('');
    const [loading,       setLoading]       = useState(false);
    const [error,         setError]         = useState('');
    const [saleCompleted, setSaleCompleted] = useState(false);
    const [changeAmount,  setChangeAmount]  = useState(0);
    const [folio,         setFolio]         = useState('');

    /* Estado de impresión post-venta */
    const [printStatus, setPrintStatus] = useState('idle'); // idle | printing | ok | error | skipped
    const [printError,  setPrintError]  = useState('');

    /* Nombre del cajero */
    const [cashierName, setCashierName] = useState('');
    useEffect(() => {
        const fromJwt = () => {
            try {
                const token = sessionStorage.getItem('numa_token');
                if (!token) return '';
                const payload = JSON.parse(atob(token.split('.')[1]));
                return payload?.name ?? payload?.email ?? payload?.full_name ?? '';
            } catch { return ''; }
        };

        if (typeof authService.getUser === 'function') {
            authService.getUser()
                .then(u => setCashierName(u?.name ?? u?.email ?? u?.full_name ?? fromJwt()))
                .catch(() => setCashierName(fromJwt()));
        } else {
            setCashierName(fromJwt());
        }
    }, []);

    const inputRef       = useRef(null);
    const formattedTotal = useMemo(() => Number(total || 0).toFixed(2), [total]);

    useEffect(() => {
        if (isOpen) {
            setPaymentMethod('cash');
            setAmountPaid('');
            setLoading(false);
            setError('');
            setSaleCompleted(false);
            setChangeAmount(0);
            setFolio('');
            setPrintStatus('idle');
            setPrintError('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    /* ── Cerrar antes de renderizar el portal ── */
    if (!isOpen) return null;

    /* ── Procesar venta ─────────────────────────────────────────── */
    const handleProcessSale = async () => {
        setError('');
        const paid = Number(amountPaid);

        if (paymentMethod === 'cash') {
            if (!amountPaid || Number.isNaN(paid) || paid < total) {
                setError('El monto pagado en efectivo es menor al total.');
                return;
            }
        }

        setLoading(true);
        try {
            const payload = {
                payment_method:   paymentMethod,
                amount_paid:      paymentMethod === 'cash' ? paid : Number(total),
                cash_register_id: cashRegisterId,
                caja_id:          cajaId,
                items:            cart.map(item => ({
                    product_id: item.id,
                    quantity:   item.quantity,
                })),
            };

            const response = await salesService.create(payload);

            const finalChange = response?.change
                ?? (paymentMethod === 'cash' ? paid - total : 0);

            setChangeAmount(finalChange);
            setFolio(response?.folio ?? '');
            setSaleCompleted(true);

            /* ── Intentar imprimir si autoPrint está habilitado ── */
            setPrintStatus('printing');
            const printResult = await printSaleTicket(response, {
                cart,
                total,
                paymentMethod,
                amountPaid:    paymentMethod === 'cash' ? paid : Number(total),
                cashier:       cashierName,
                caja:          cajaNombre,
            });

            if (printResult.ok) {
                setPrintStatus('ok');
            } else if (printResult.error === 'No hay impresora con impresión automática habilitada.') {
                setPrintStatus('skipped');
            } else {
                setPrintStatus('error');
                setPrintError(printResult.error);
            }

        } catch (err) {
            setError(err.message || 'Ocurrió un error al procesar la venta.');
            setSaleCompleted(false);
            setPrintStatus('idle');
        } finally {
            setLoading(false);
        }
    };

    const handleFinishAndClear = () => {
        setSaleCompleted(false);
        setAmountPaid('');
        setChangeAmount(0);
        setFolio('');
        setPrintStatus('idle');
        setPrintError('');
        onFinishSale();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !loading && !saleCompleted) handleProcessSale();
    };

    /* ════════════════════════════════════════════════════════════════
       Render — portal al body para escapar del stacking context del
       slide-panel con transform CSS (que atrapaba el z-index del modal)
    ════════════════════════════════════════════════════════════════ */
    return ReactDOM.createPortal(
        /* En móvil: bottom-sheet (sube desde abajo, full-width, esquinas
           superiores redondeadas). En escritorio: dialog centrado. */
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4">
            <div className="w-full md:w-[480px] max-h-[92dvh] md:max-h-[90vh] rounded-t-[28px] md:rounded-[28px] bg-white shadow-2xl flex flex-col overflow-hidden">

                {/* ── Header ── */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">
                            {saleCompleted ? 'Venta completada' : 'Confirmar cobro'}
                        </h3>
                        <p className="text-sm text-slate-500">
                            {saleCompleted
                                ? `Folio ${folio} registrado correctamente.`
                                : 'Revisa el total y el método de pago.'}
                        </p>
                    </div>
                    {!saleCompleted && (
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                        >
                            <span className="material-symbols-outlined text-slate-600">close</span>
                        </button>
                    )}
                </div>

                <div className="p-6 overflow-y-auto flex-1 min-h-0">

                    {/* ── Pantalla de éxito ── */}
                    {saleCompleted ? (
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[48px]">check_circle</span>
                            </div>

                            <div>
                                <h4 className="text-3xl font-black text-slate-900">¡Cobro exitoso!</h4>
                                <p className="text-slate-500 mt-1">El ticket quedó registrado.</p>
                            </div>

                            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                                <div className="flex items-center justify-between text-sm text-slate-600">
                                    <span>Total cobrado</span>
                                    <span className="font-bold">${formattedTotal}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm text-slate-600">
                                    <span>Método</span>
                                    <span className="font-bold capitalize">{paymentMethod}</span>
                                </div>

                                {paymentMethod === 'cash' && (
                                    <div className="rounded-2xl bg-white border border-slate-200 p-4">
                                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                                            Cambio a entregar
                                        </p>
                                        <p className="text-4xl font-black text-emerald-600">
                                            ${Number(changeAmount).toFixed(2)}
                                        </p>
                                    </div>
                                )}

                                {/* ── Estado de impresión ── */}
                                <PrintStatusBadge status={printStatus} error={printError} />
                            </div>

                            <button
                                onClick={handleFinishAndClear}
                                className="w-full py-4 rounded-2xl bg-slate-900 text-white text-lg font-black
                                           hover:bg-slate-800 transition-colors"
                            >
                                Aceptar y nuevo ticket
                            </button>
                        </div>

                    ) : (

                        /* ── Pantalla de pago ── */
                        <div className="grid gap-6">

                            {/* Total */}
                            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5">
                                <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                                    Total a cobrar
                                </p>
                                <p className="text-5xl font-black text-slate-900 mt-2">
                                    ${formattedTotal}
                                </p>
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700
                                                text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined">error</span>
                                    {error}
                                </div>
                            )}

                            {/* Método de pago */}
                            <div className="space-y-3">
                                <label className="text-sm font-bold text-slate-600 block">
                                    Método de pago
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { value: 'cash', label: 'Efectivo', icon: 'payments' },
                                        { value: 'card', label: 'Tarjeta',  icon: 'credit_card' },
                                    ].map(m => (
                                        <button
                                            key={m.value}
                                            onClick={() => {
                                                setPaymentMethod(m.value);
                                                setAmountPaid(m.value === 'card' ? total.toFixed(2) : '');
                                                if (m.value === 'cash') setTimeout(() => inputRef.current?.focus(), 50);
                                            }}
                                            className={`py-4 rounded-2xl border-2 font-bold flex items-center justify-center gap-2
                                                        transition-all
                                                        ${paymentMethod === m.value
                                                            ? 'border-slate-900 bg-slate-900 text-white'
                                                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            <span className="material-symbols-outlined">{m.icon}</span>
                                            {m.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Input efectivo */}
                            {paymentMethod === 'cash' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-600 block">
                                        Efectivo recibido
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-500">$</span>
                                        <input
                                            ref={inputRef}
                                            type="number"
                                            min={total}
                                            step="0.01"
                                            value={amountPaid}
                                            onChange={e => setAmountPaid(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            className="w-full pl-9 pr-4 py-4 rounded-2xl border-2 border-slate-200 bg-white
                                                       text-2xl font-black focus:outline-none focus:border-slate-900
                                                       focus:ring-4 focus:ring-slate-900/10 transition-all"
                                            placeholder="0.00"
                                        />
                                    </div>

                                    {/* Accesos rápidos */}
                                    <div className="grid grid-cols-4 gap-2">
                                        {[...new Set([
                                            Number(total),
                                            Math.ceil(total / 10)  * 10,
                                            Math.ceil(total / 50)  * 50,
                                            Math.ceil(total / 100) * 100,
                                        ])].slice(0, 4).map(v => (
                                            <button
                                                key={v}
                                                onClick={() => setAmountPaid(v.toFixed(2))}
                                                className="py-2 rounded-xl border border-slate-200 text-sm font-bold
                                                           text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                ${v % 1 === 0 ? v : v.toFixed(2)}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Cambio en tiempo real */}
                                    {Number(amountPaid) > 0 && (
                                        <div className={`rounded-xl px-4 py-3 flex justify-between items-baseline
                                            ${Number(amountPaid) >= total
                                                ? 'bg-emerald-50 border border-emerald-200'
                                                : 'bg-red-50 border border-red-200'}`}>
                                            <span className="text-sm font-bold text-slate-600">Cambio</span>
                                            <span className={`text-2xl font-black
                                                ${Number(amountPaid) >= total ? 'text-emerald-600' : 'text-red-600'}`}>
                                                ${Math.max(0, Number(amountPaid) - total).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Botón confirmar */}
                            <button
                                onClick={handleProcessSale}
                                disabled={loading || (paymentMethod === 'cash' && Number(amountPaid) < total)}
                                className="w-full py-4 rounded-2xl bg-emerald-600 text-white text-xl font-black
                                           hover:bg-emerald-700 shadow-lg flex items-center justify-center gap-2
                                           transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                        Procesando...
                                    </>
                                ) : 'Confirmar venta'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

/* ── Badge de estado de impresión ─────────────────────────────────── */
function PrintStatusBadge({ status, error }) {
    if (status === 'idle' || status === 'skipped') return null;

    const configs = {
        printing: {
            icon: 'autorenew',
            spin: true,
            text: 'Enviando a la impresora…',
            cls:  'bg-blue-50 border-blue-200 text-blue-700',
        },
        ok: {
            icon: 'print',
            spin: false,
            text: 'Ticket impreso correctamente',
            cls:  'bg-emerald-50 border-emerald-200 text-emerald-700',
        },
        error: {
            icon: 'print_disabled',
            spin: false,
            text: `Error al imprimir${error ? `: ${error}` : ''}`,
            cls:  'bg-red-50 border-red-200 text-red-700',
        },
    };

    const c = configs[status];
    if (!c) return null;

    return (
        <div className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${c.cls}`}>
            <span className={`material-symbols-outlined text-[18px] shrink-0 mt-px ${c.spin ? 'animate-spin' : ''}`}>
                {c.icon}
            </span>
            <span className="text-left leading-snug">{c.text}</span>
        </div>
    );
}