/* ═══════════════════════════════════════════════════════════════════════════
   ConfirmDeleteModal.jsx
   Modal de confirmación genérico y reutilizable para acciones destructivas.
   — Maneja su propio estado de "eliminando..." y de error.
   — onConfirm debe ser una función async; si lanza un error, se muestra
     dentro del modal sin cerrarlo (para que el usuario pueda reintentar).
   — El padre es responsable de cerrar el modal (isOpen=false) cuando
     onConfirm termina exitosamente.
   — En móvil, el sheet flota con un margen inferior para no quedar tapado
     por el BottomNav.
═══════════════════════════════════════════════════════════════════════════ */
import { useState, useRef, useEffect } from 'react';

export default function ConfirmDeleteModal({
    isOpen,
    onClose,
    onConfirm,
    title = '¿Eliminar este elemento?',
    itemName,
    description,
    confirmLabel = 'Sí, eliminar',
    cancelLabel = 'Cancelar',
}) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    // Limpia el error cada vez que se vuelve a abrir el modal
    useEffect(() => {
        if (isOpen) setError('');
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setError('');
        setDeleting(true);
        try {
            await onConfirm();
            // Éxito: el padre se encarga de cerrar el modal vía isOpen=false.
        } catch (err) {
            if (mountedRef.current) {
                setError(err?.message || 'Ocurrió un error al intentar eliminar. Intenta de nuevo.');
            }
        } finally {
            if (mountedRef.current) setDeleting(false);
        }
    };

    const handleClose = () => {
        if (deleting) return; // evita cerrar mientras se está procesando
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[70] flex items-end md:items-center md:justify-center backdrop-blur-sm pb-24 md:pb-0 px-3 md:px-0"
            onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
            aria-modal="true"
            role="alertdialog"
        >
            <div className="w-full md:w-[420px] bg-white rounded-[28px] shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="w-12 h-1.5 bg-outline-variant/50 rounded-full mx-auto mt-4 mb-3 md:hidden" />

                <div className="px-6 pt-2 pb-6 flex flex-col items-center text-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-error-container flex items-center justify-center">
                        <span className="material-symbols-outlined text-[28px] text-error">delete</span>
                    </div>

                    <div>
                        <h3 className="text-xl font-black text-on-surface mb-1.5">{title}</h3>
                        <p className="text-sm text-on-surface-variant font-medium leading-relaxed">
                            {description || (
                                <>
                                    ¿Seguro que quieres eliminar{' '}
                                    {itemName ? <span className="font-bold text-on-surface">"{itemName}"</span> : 'este elemento'}?
                                    {' '}Esta acción no se puede deshacer.
                                </>
                            )}
                        </p>
                    </div>

                    {error && (
                        <div className="w-full p-3.5 bg-error-container rounded-xl flex items-center gap-2 text-left" aria-live="polite">
                            <span className="material-symbols-outlined text-error text-[20px] shrink-0">error</span>
                            <p className="text-error font-bold text-sm">{error}</p>
                        </div>
                    )}

                    <div className="w-full flex flex-col-reverse sm:flex-row gap-3 mt-1">
                        <button
                            onClick={handleClose}
                            disabled={deleting}
                            className="flex-1 py-3.5 rounded-xl text-base font-bold text-on-surface-variant border-2 border-outline-variant hover:bg-surface-container-low transition-colors disabled:opacity-50"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={deleting}
                            className="flex-1 py-3.5 rounded-xl text-base font-black text-white bg-error hover:bg-error/90 active:scale-[0.98] shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {deleting ? (
                                <>
                                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                                    Eliminando…
                                </>
                            ) : confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}