import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';

/**
 * BarcodeScannerModal — escáner de códigos de barras/QR reutilizable.
 *
 * Props:
 *   isOpen     boolean        — controla visibilidad
 *   onClose    () => void     — cierre manual
 *   onDetected (code) => void — llamado cada vez que se detecta un código (sin cerrar)
 *   title      string         — título del modal (default: 'Escanear código')
 *
 * Uso:
 *   <BarcodeScannerModal
 *     isOpen={scannerOpen}
 *     onClose={() => setScannerOpen(false)}
 *     onDetected={(code) => handleCode(code)}
 *     title="Escanear SKU"
 *   />
 *
 * Notas:
 *   - Cierre MANUAL por el usuario (permite escanear varios consecutivos).
 *   - Cooldown de 1.5 s para evitar lecturas duplicadas del mismo frame.
 *   - Vibración háptica al detectar (si el dispositivo lo soporta).
 *   - Usa cámara trasera (facingMode: environment) por defecto.
 *   - Para migrar a Capacitor/ML Kit en el futuro, reemplaza el useEffect
 *     interno manteniendo la misma interfaz de props.
 */
export default function BarcodeScannerModal({
    isOpen,
    onClose,
    onDetected,
    title = 'Escanear código',
}) {
    const videoRef    = useRef(null);
    const controlsRef = useRef(null);
    const cooldownRef = useRef(false);

    const [lastCode,  setLastCode]  = useState('');
    const [scanCount, setScanCount] = useState(0);
    const [cameraErr, setCameraErr] = useState('');
    const [starting,  setStarting]  = useState(false);

    /* ── Callback estable para el lector ── */
    const handleResult = useCallback((code) => {
        if (cooldownRef.current) return;

        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; }, 1500);

        setLastCode(code);
        setScanCount(n => n + 1);
        onDetected(code);

        if (navigator.vibrate) navigator.vibrate([70]);
    }, [onDetected]);

    /* ── Iniciar / detener cámara según isOpen ── */
    useEffect(() => {
        if (!isOpen) return;

        setLastCode('');
        setScanCount(0);
        setCameraErr('');
        cooldownRef.current = false;

        let cancelled = false;

        const start = async () => {
            setStarting(true);
            try {
                const reader = new BrowserMultiFormatReader();

                const controls = await reader.decodeFromConstraints(
                    {
                        video: {
                            facingMode:  { ideal: 'environment' },
                            width:       { ideal: 1280 },
                            height:      { ideal: 720 },
                        },
                    },
                    videoRef.current,
                    (result, _err, _controls) => {
                        // _err es NotFoundException en frames sin código — se ignora
                        if (result && !cancelled) {
                            handleResult(result.getText());
                        }
                    }
                );

                if (cancelled) {
                    try { controls.stop(); } catch (_) {}
                    return;
                }
                controlsRef.current = controls;
            } catch (e) {
                if (cancelled) return;
                const msg = (e?.message || '').toLowerCase();
                if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
                    setCameraErr('Permiso de cámara denegado. Habilítalo en la configuración del navegador.');
                } else if (msg.includes('notfound') || msg.includes('devicesnotfound')) {
                    setCameraErr('No se encontró ninguna cámara en este dispositivo.');
                } else {
                    setCameraErr('No se pudo iniciar la cámara. Cierra y vuelve a intentarlo.');
                }
            } finally {
                if (!cancelled) setStarting(false);
            }
        };

        start();

        return () => {
            cancelled = true;
            if (controlsRef.current) {
                try { controlsRef.current.stop(); } catch (_) {}
                controlsRef.current = null;
            }
        };
    }, [isOpen, handleResult]);

    if (!isOpen) return null;

    return (
        <>
            {/* Animación de la línea de escaneo */}
            <style>{`
                @keyframes numaScanLine {
                    0%   { top: 4px; }
                    50%  { top: calc(100% - 4px); }
                    100% { top: 4px; }
                }
                .numa-scan-line {
                    position: absolute;
                    left: 10px;
                    right: 10px;
                    height: 2px;
                    border-radius: 1px;
                    background-color: #4ade80;
                    box-shadow: 0 0 8px 2px rgba(74, 222, 128, 0.6);
                    animation: numaScanLine 2s ease-in-out infinite;
                }
            `}</style>

            {/* Pantalla completa — z-index mayor que ProductFormModal (z-100) */}
            <div
                className="fixed inset-0 z-[350] bg-black flex flex-col"
                style={{ touchAction: 'none' }}
            >

                {/* ── Header ── */}
                <div className="relative z-10 flex items-center justify-between px-4 py-4 bg-gradient-to-b from-black/90 to-transparent shrink-0">
                    <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-white text-[22px]">
                            qr_code_scanner
                        </span>
                        <span className="text-white font-semibold text-[16px]">{title}</span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/15 text-white active:bg-white/30 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[22px]">close</span>
                    </button>
                </div>

                {/* ── Vista de cámara ── */}
                <div className="flex-1 relative overflow-hidden">

                    <video
                        ref={videoRef}
                        className="absolute inset-0 w-full h-full object-cover"
                        muted
                        playsInline
                        autoPlay
                    />

                    {/* Degradado lateral para oscurecer fuera del visor */}
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            background: `radial-gradient(
                                ellipse 280px 160px at 50% 50%,
                                transparent 0%,
                                rgba(0,0,0,0.45) 100%
                            )`,
                        }}
                    />

                    {/* Marco del visor */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="relative" style={{ width: 268, height: 158 }}>

                            {/* Esquinas del visor */}
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-white/90 rounded-tl" />
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-white/90 rounded-tr" />
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-white/90 rounded-bl" />
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-white/90 rounded-br" />

                            {/* Línea de escaneo animada */}
                            <div className="numa-scan-line" />

                        </div>
                    </div>

                    {/* Spinner de inicio */}
                    {starting && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                            <span className="material-symbols-outlined text-white text-[44px] animate-spin">
                                progress_activity
                            </span>
                            <p className="text-white/70 text-[13px]">Iniciando cámara…</p>
                        </div>
                    )}

                    {/* Error de cámara */}
                    {cameraErr && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center">
                            <span className="material-symbols-outlined text-red-400 text-[52px]">
                                no_photography
                            </span>
                            <p className="text-white text-[14px] leading-relaxed">{cameraErr}</p>
                            <button
                                type="button"
                                onClick={onClose}
                                className="mt-2 px-6 py-2.5 bg-white/15 text-white rounded-full text-[14px] font-medium active:bg-white/25"
                            >
                                Cerrar
                            </button>
                        </div>
                    )}

                </div>

                {/* ── Footer: último código escaneado ── */}
                <div className="px-5 py-5 bg-gradient-to-t from-black/90 to-transparent shrink-0 min-h-[100px] flex flex-col justify-center gap-2">
                    {lastCode ? (
                        <>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-[10px] text-white/50 uppercase tracking-widest">
                                    Detectado · {scanCount} {scanCount === 1 ? 'lectura' : 'lecturas'}
                                </span>
                            </div>

                            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-3">
                                <span className="material-symbols-outlined text-green-400 text-[20px] shrink-0">
                                    check_circle
                                </span>
                                <span className="text-white font-mono text-[15px] flex-1 truncate">
                                    {lastCode}
                                </span>
                            </div>

                            <p className="text-[11px] text-white/35 text-center">
                                Apunta a otro código o cierra el escáner
                            </p>
                        </>
                    ) : (
                        <div className="text-center">
                            <p className="text-white/55 text-[13px]">
                                Apunta la cámara al código de barras
                            </p>
                            <p className="text-white/30 text-[11px] mt-1">
                                EAN‑13 · UPC · QR · Code128 · y más
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}