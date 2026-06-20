/* ═══════════════════════════════════════════════════════════════════════════
   MovimientoCajaModal.jsx
   Modal para registrar entradas y salidas manuales de efectivo en caja.
═══════════════════════════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { cajasService } from '../services/api';

export default function MovimientoCajaModal({ isOpen, onClose, caja, onMovementCreated }) {
    const [type,    setType]    = useState('in');
    const [amount,  setAmount]  = useState('');
    const [reason,  setReason]  = useState('');
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState('');
    const [success, setSuccess] = useState(false);

    const amountRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setType('in');
            setAmount('');
            setReason('');
            setError('');
            setSuccess(false);
            setTimeout(() => amountRef.current?.focus(), 100);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setError('');
        const amt = parseFloat(amount);

        if (!amount || isNaN(amt) || amt <= 0) {
            setError('Ingresa un monto válido mayor a 0.');
            return;
        }
        if (!reason.trim()) {
            setError('El motivo es requerido.');
            return;
        }

        setLoading(true);
        try {
            await cajasService.createMovement({
                caja_id: caja.id,
                type,
                amount:  amt,
                reason:  reason.trim(),
            });
            setSuccess(true);
            onMovementCreated?.();
            setTimeout(() => {
                setSuccess(false);
                setAmount('');
                setReason('');
                onClose();
            }, 1400);
        } catch (err) {
            setError(err.message || 'Error al registrar el movimiento.');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !loading && !success) handleSubmit();
    };

    const isEntrada = type === 'in';

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4">
            <div className="w-full md:w-[480px] max-h-[92dvh] md:max-h-[85vh] rounded-t-[28px] md:rounded-[28px] bg-white shadow-2xl flex flex-col overflow-hidden">

                {/* ── Header ── */}
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Movimiento de Caja</h3>
                        <p className="text-sm text-slate-500">{caja?.name ?? '—'}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
                    >
                        <span className="material-symbols-outlined text-slate-600">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

                    {/* ── Tipo: Entrada / Salida ── */}
                    <div className="grid grid-cols-2 gap-3">
                        {[
                            { value: 'in',  label: 'Entrada', icon: 'add_circle',    activeClass: 'border-emerald-600 bg-emerald-600 text-white' },
                            { value: 'out', label: 'Salida',  icon: 'remove_circle', activeClass: 'border-red-600 bg-red-600 text-white' },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => { setType(opt.value); setError(''); }}
                                className={`py-4 rounded-2xl border-2 font-bold flex flex-col items-center gap-1.5 transition-all ${
                                    type === opt.value
                                        ? opt.activeClass
                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[26px]">{opt.icon}</span>
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Monto ── */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-600 block">Monto</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">$</span>
                            <input
                                ref={amountRef}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={amount}
                                onChange={e => { setAmount(e.target.value); setError(''); }}
                                onKeyDown={handleKeyDown}
                                placeholder="0.00"
                                className="w-full pl-9 pr-4 py-3.5 rounded-2xl border-2 border-slate-200 text-2xl font-black focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all"
                            />
                        </div>
                    </div>

                    {/* ── Motivo ── */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-600 block">Motivo</label>
                        <input
                            type="text"
                            value={reason}
                            onChange={e => { setReason(e.target.value); setError(''); }}
                            onKeyDown={handleKeyDown}
                            placeholder={isEntrada ? 'Ej. Fondo de cambio' : 'Ej. Pago a proveedor'}
                            className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-[15px] focus:outline-none focus:border-slate-900 focus:ring-4 focus:ring-slate-900/10 transition-all"
                        />
                    </div>

                    {/* ── Error ── */}
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm font-semibold flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    {/* ── Botón principal ── */}
                    <button
                        onClick={handleSubmit}
                        disabled={loading || success}
                        className={`w-full py-4 rounded-2xl text-white text-lg font-black transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                            success
                                ? 'bg-emerald-600'
                                : isEntrada
                                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'
                                    : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20'
                        }`}
                    >
                        {success ? (
                            <>
                                <span className="material-symbols-outlined">check_circle</span>
                                Registrado correctamente
                            </>
                        ) : loading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                Guardando...
                            </>
                        ) : (
                            `Registrar ${isEntrada ? 'entrada' : 'salida'}`
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}