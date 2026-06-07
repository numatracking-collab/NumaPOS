/* ═══════════════════════════════════════════════════════════════════════════
   CancelSaleModal.jsx — Modal de confirmación para cancelar una venta
   Diseño compacto que cabe en cualquier tamaño de pantalla.
═══════════════════════════════════════════════════════════════════════════ */

import { useState } from 'react';

export default function CancelSaleModal({ folio, onConfirm, onClose, loading, error = '' }) {
    const [reason, setReason] = useState('');

    return (
        /* ── Overlay ── */
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
        >
            <div className="bg-surface-bright rounded-2xl shadow-2xl w-full max-w-[360px] border border-outline-variant/30 overflow-hidden">

                {/* ── Franja de alerta superior ── */}
                <div className="bg-error/10 border-b border-error/20 px-5 py-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-error/15 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[20px] text-error" aria-hidden="true">
                            cancel
                        </span>
                    </div>
                    <div className="min-w-0">
                        <h2
                            id="cancel-modal-title"
                            className="text-[15px] font-black text-on-surface leading-tight"
                        >
                            ¿Cancelar esta venta?
                        </h2>
                        <p className="text-[12px] text-on-surface-variant mt-0.5">
                            Folio{' '}
                            <span className="font-mono font-bold text-on-surface">{folio}</span>
                        </p>
                    </div>
                </div>

                {/* ── Cuerpo ── */}
                <div className="px-5 py-4 flex flex-col gap-3">

                    {/* Descripción breve */}
                    <p className="text-[13px] text-on-surface-variant leading-relaxed">
                        La venta quedará marcada como cancelada y el stock de cada
                        producto se devolverá al inventario.{' '}
                        <span className="text-error font-semibold">
                            Esta acción no se puede deshacer.
                        </span>
                    </p>

                    {/* Error del servidor */}
                    {error && (
                        <div className="flex items-start gap-2 rounded-xl bg-error/10 border border-error/30 px-3 py-2 text-[12px] text-error">
                            <span className="material-symbols-outlined text-[14px] shrink-0 mt-px" aria-hidden="true">
                                error
                            </span>
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Motivo */}
                    <div className="flex flex-col gap-1">
                        <label
                            htmlFor="cancel-reason"
                            className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide"
                        >
                            Motivo{' '}
                            <span className="font-normal normal-case">
                                (opcional)
                            </span>
                        </label>
                        <textarea
                            id="cancel-reason"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="Ej: Error en el pedido, devolución…"
                            rows={2}
                            maxLength={300}
                            disabled={loading}
                            className="
                                w-full rounded-xl border border-outline-variant
                                bg-surface-container-low px-3 py-2
                                text-[13px] text-on-surface
                                placeholder:text-on-surface-variant/40
                                resize-none
                                focus:outline-none focus:ring-2 focus:ring-error/30 focus:border-error/50
                                transition-colors disabled:opacity-50
                            "
                        />
                        <p className="text-[10px] text-on-surface-variant/50 text-right">
                            {reason.length}/300
                        </p>
                    </div>
                </div>

                {/* ── Acciones ── */}
                <div className="px-5 pb-5 flex gap-2">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="
                            flex-1 py-2.5 rounded-xl
                            border border-outline-variant
                            text-[13px] font-semibold text-on-surface-variant
                            bg-surface-container-low hover:bg-surface-container
                            transition-colors disabled:opacity-50
                        "
                    >
                        Volver
                    </button>

                    <button
                        onClick={() => onConfirm(reason)}
                        disabled={loading}
                        aria-label="Confirmar cancelación de la venta"
                        className="
                            flex-1 py-2.5 rounded-xl
                            bg-error text-[13px] font-bold text-white
                            hover:bg-error/90 active:scale-[0.98]
                            transition-all disabled:opacity-60 disabled:cursor-not-allowed
                            flex items-center justify-center gap-1.5
                        "
                    >
                        {loading ? (
                            <>
                                <span className="material-symbols-outlined text-[15px] animate-spin" aria-hidden="true">
                                    sync
                                </span>
                                Cancelando…
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                                    cancel
                                </span>
                                Sí, cancelar
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}