import { useEffect, useState } from 'react';
import { appUpdatesService } from '../services/api';
import { APP_VERSION } from '../config/appVersion';

const DISMISSED_KEY = 'numa_pos_dismissed_update_version';
export { DISMISSED_KEY };

export default function UpdateNotice() {
    const [update, setUpdate] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        appUpdatesService.getLatest()
            .then(({ update }) => {
                if (!update) return;
                if (update.version === APP_VERSION) return;

                const alreadyDismissed = sessionStorage.getItem(DISMISSED_KEY) === update.version;
                if (alreadyDismissed && !update.is_mandatory) return;

                setUpdate(update);
            })
            .catch(err => console.error('Error al checar actualizaciones:', err));
    }, []);

    if (!update || dismissed) return null;

    const handleDismiss = () => {
        sessionStorage.setItem(DISMISSED_KEY, update.version);
        setDismissed(true);
    };

    const handleDownload = () => {
        window.open(update.apk_url, '_blank');
    };

    // ── Obligatoria: modal bloqueante, no descartable ──────────────────────
    if (update.is_mandatory) {
        return (
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm my-auto max-h-[90vh] flex flex-col overflow-hidden">
                    <div className="bg-secondary px-lg py-lg text-center">
                        <span className="material-symbols-outlined text-white text-[40px]"
                            style={{ fontVariationSettings: "'FILL' 1" }}>system_update</span>
                        <h2 className="text-white font-headline-md text-headline-md mt-2">Actualización requerida</h2>
                    </div>
                    <div className="p-lg overflow-y-auto space-y-md">
                        <p className="text-[13px] text-on-surface-variant">
                            Necesitas instalar la versión <span className="font-bold text-on-surface">{update.version}</span> para
                            seguir usando NUMA POS.
                        </p>
                        {update.changelog && (
                            <div className="bg-surface-container-low rounded-xl p-md">
                                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wide mb-1">Novedades</p>
                                <p className="text-[12px] text-on-surface whitespace-pre-line">{update.changelog}</p>
                            </div>
                        )}
                        <button
                            onClick={handleDownload}
                            className="w-full py-md bg-secondary text-on-secondary font-headline-md text-headline-md rounded-xl flex items-center justify-center gap-md hover:opacity-95 transition-all active:scale-[0.97]"
                        >
                            <span className="material-symbols-outlined">download</span>
                            Descargar actualización
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Opcional: banner descartable arriba de la pantalla ──────────────────
    return (
        <div className="shrink-0 z-30 mx-md mt-md rounded-xl overflow-hidden border border-secondary/30 bg-gradient-to-r from-secondary/10 to-secondary/5 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-secondary to-secondary/40" />
            <div className="px-md py-sm flex items-start justify-between gap-sm">
                <div className="flex items-start gap-xs min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-secondary shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}>system_update</span>
                    <div className="min-w-0">
                        <p className="font-bold text-[13px] text-secondary">Nueva versión disponible: {update.version}</p>
                        {update.changelog && (
                            <p className="text-[11px] text-on-surface-variant truncate">{update.changelog}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-xs shrink-0">
                    <button onClick={handleDownload}
                        className="flex items-center gap-1 py-xs px-sm bg-secondary text-on-secondary text-[12px] font-bold rounded-lg hover:bg-secondary/90 active:scale-[0.97] transition-all">
                        <span className="material-symbols-outlined text-[14px]">download</span>
                        Descargar
                    </button>
                    <button onClick={handleDismiss}
                        className="w-6 h-6 flex items-center justify-center rounded-md text-on-surface-variant hover:bg-surface-container-high transition-colors">
                        <span className="material-symbols-outlined text-[15px]">close</span>
                    </button>
                </div>
            </div>
        </div>
    );
}