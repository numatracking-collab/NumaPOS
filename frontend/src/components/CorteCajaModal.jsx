/* ═══════════════════════════════════════════════════════════════════════════
   CorteCajaModal.jsx
   Modal para realizar el corte de caja — CORTE CIEGO.

   Flujo:
   1. El cajero ingresa lo que contó físicamente (efectivo y tarjeta),
      SIN ver los saldos esperados por el sistema ni si cuadra o no.
   2. Campo opcional para dejar saldo en caja al siguiente turno.
   3. Al guardar el corte, se muestra confirmación sin detallar diferencias:
      el corte se calcula y guarda en el servidor; las diferencias solo
      se consultan después en Historial → Cortes de caja.
═══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { cajasService } from '../services/api';

/* ═══════════════════════════════════════════════════════════════════════════
   CorteCajaModal
═══════════════════════════════════════════════════════════════════════════ */
export default function CorteCajaModal({ isOpen, onClose, caja }) {
    const [countedCash,  setCountedCash]  = useState('');
    const [countedCard,  setCountedCard]  = useState('');
    const [leaveBalance, setLeaveBalance] = useState('');
    const [notes,        setNotes]        = useState('');

    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState(false);
    const [folio,   setFolio]   = useState('');

    const cashRef = useRef(null);

    useEffect(() => {
        if (isOpen && caja?.id) {
            setCountedCash('');
            setCountedCard('');
            setLeaveBalance('');
            setNotes('');
            setError('');
            setSuccess(false);
            setFolio('');
            setTimeout(() => cashRef.current?.focus(), 100);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, caja?.id]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setError('');
        if (countedCash === '') {
            setError('Ingresa el efectivo contado (puede ser 0).');
            return;
        }

        setLoading(true);
        try {
            const result = await cajasService.createCorte({
                caja_id:       caja.id,
                counted_cash:  Number(countedCash  || 0),
                counted_card:  Number(countedCard  || 0),
                leave_balance: Number(leaveBalance || 0),
                notes,
            });
            setFolio(result.folio ?? '');
            setSuccess(true);
        } catch (err) {
            setError(err.message || 'Error al guardar el corte.');
        } finally {
            setLoading(false);
        }
    };

    /* ══════════════════════════════════════════════════════════════════════
       RENDER
    ══════════════════════════════════════════════════════════════════════ */
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4">
            <div className="w-full md:w-[520px] max-h-[92dvh] md:max-h-[90vh] rounded-t-[28px] md:rounded-[28px] bg-white shadow-2xl flex flex-col overflow-hidden">

                {/* ── Header ── */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">
                            {success ? 'Corte guardado' : 'Realizar Corte'}
                        </h3>
                        <p className="text-sm text-slate-500">{caja?.name ?? '—'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-600">close</span>
                    </button>
                </div>

                {/* ── Contenido ── */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* ════ ÉXITO ════ */}
                    {success ? (
                        <div className="flex flex-col items-center text-center gap-5 py-4">
                            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[48px]">check_circle</span>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-900">¡Corte completado!</p>
                                {folio && (
                                    <p className="text-slate-500 mt-1">
                                        Folio <span className="font-mono font-bold text-slate-700">{folio}</span>
                                    </p>
                                )}
                            </div>
                            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 w-full text-left text-sm text-slate-600 leading-relaxed">
                                El corte quedó registrado. Consulta el detalle y las diferencias en{' '}
                                <strong className="text-slate-800">Historial → Cortes de caja</strong>.
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full py-4 rounded-2xl bg-slate-900 text-white text-lg font-black hover:bg-slate-800 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>

                    ) : (

                        /* ════ FORMULARIO — corte ciego ════ */
                        <div className="flex flex-col gap-5">

                            <p className="text-sm text-slate-500 -mb-1">
                                Cuenta el efectivo y la tarjeta físicamente y captura las cantidades aquí.
                            </p>

                            {/* Efectivo contado */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">payments</span>
                                    Efectivo contado
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">$</span>
                                    <input
                                        ref={cashRef}
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={countedCash}
                                        onChange={e => { setCountedCash(e.target.value); setError(''); }}
                                        placeholder="0.00"
                                        className="w-full pl-9 pr-4 py-3 rounded-2xl border-2 border-slate-200 text-xl font-black focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Tarjeta contada */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">credit_card</span>
                                    Tarjeta contada
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={countedCard}
                                        onChange={e => { setCountedCard(e.target.value); setError(''); }}
                                        placeholder="0.00"
                                        className="w-full pl-9 pr-4 py-3 rounded-2xl border-2 border-slate-200 text-xl font-black focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Saldo para siguiente turno */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">savings</span>
                                    Dejar en caja para el siguiente turno
                                    <span className="text-[11px] font-normal text-slate-400">(opcional)</span>
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={leaveBalance}
                                        onChange={e => setLeaveBalance(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full pl-9 pr-4 py-3 rounded-2xl border-2 border-slate-200 text-base focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Notas */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-600 flex items-center gap-1">
                                    Notas
                                    <span className="text-[11px] font-normal text-slate-400 ml-1">(opcional)</span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Observaciones del corte..."
                                    className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-sm resize-none focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all"
                                />
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm font-semibold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">error</span>
                                    {error}
                                </div>
                            )}

                            {/* Botón */}
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="w-full py-4 rounded-2xl bg-slate-900 text-white text-lg font-black hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                        Guardando corte...
                                    </>
                                ) : 'Guardar Corte'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}