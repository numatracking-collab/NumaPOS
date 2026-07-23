import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { isCapacitor } from '../../services/runtimeEnv';

/**
 * BarcodeScannerModal — escáner de códigos de barras/QR reutilizable.
 *
 * Comportamiento según entorno (detectado automáticamente vía runtimeEnv.js):
 *
 *   Web      → usa @zxing/browser + getUserMedia (video element en el modal)
 *   Capacitor→ usa @capacitor-mlkit/barcode-scanning (ML Kit nativo de Android)
 *              El permiso de cámara se solicita vía el diálogo nativo de Android,
 *              NO vía el popup del "navegador" del WebView.
 *              La cámara aparece en la capa nativa detrás del WebView transparente.
 *
 * Props:
 *   isOpen      boolean          controla visibilidad
 *   onClose     () => void       cierre manual (el escáner NO se cierra solo al detectar)
 *   onDetected  (code) => void   llamado cada vez que se detecta un código
 *   title       string           título del modal  (default: 'Escanear código')
 *
 * Para migrar a otro plugin nativo en el futuro, solo cambia las funciones
 * startCapacitorScan / stopCapacitorScan — la interfaz de props no cambia.
 */

/* ── Formatos de código de barras que solicitamos a ML Kit ────────────────── */
const getCapacitorFormats = async () => {
  const { BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning');
  return [
    BarcodeFormat.Ean13,
    BarcodeFormat.Ean8,
    BarcodeFormat.UpcA,
    BarcodeFormat.UpcE,
    BarcodeFormat.Code128,
    BarcodeFormat.Code39,
    BarcodeFormat.Code93,
    BarcodeFormat.QrCode,
    BarcodeFormat.DataMatrix,
  ];
};

/* ══════════════════════════════════════════════════════════════════════════
   FIX TRANSPARENCIA — la técnica oficial del plugin
   ────────────────────────────────────────────────────────────────────────
   ML Kit dibuja el preview de la cámara en una capa nativa DETRÁS del
   WebView de Android. La documentación oficial de
   @capacitor-mlkit/barcode-scanning es explícita: "si no puedes ver la
   cámara, asegúrate de que TODOS los elementos del DOM sean invisibles o
   tengan fondo transparente" — no solo los ancestros directos.

   Intentar listar manualmente cada contenedor (html, body, #root, etc.)
   es frágil porque cualquier componente anidado en cualquier profundidad
   (ej. ProductFormModal, que vive varios niveles abajo) puede tener su
   propio bg-* y seguir bloqueando la vista.

   La técnica robusta: ocultar con visibility:hidden ABSOLUTAMENTE TODO
   en el documento, y luego, usando especificidad de selector, volver a
   mostrar SOLO el subárbol del propio overlay del escáner (marcado con
   la clase .numa-scanner-overlay). visibility:hidden no pinta fondo ni
   contenido, pero conserva el layout — y los hijos pueden "revertir" la
   visibilidad heredada con visibility:visible.
   ════════════════════════════════════════════════════════════════════════ */
const SCANNER_TRANSPARENCY_STYLE_ID = 'numa-scanner-transparency-style';

function injectTransparencyStyles() {
  if (document.getElementById(SCANNER_TRANSPARENCY_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = SCANNER_TRANSPARENCY_STYLE_ID;
  style.textContent = `
    html.numa-scanner-active,
    html.numa-scanner-active body {
      background: transparent !important;
    }
    html.numa-scanner-active * {
      visibility: hidden !important;
      background: transparent !important;
    }
    html.numa-scanner-active .numa-scanner-overlay,
    html.numa-scanner-active .numa-scanner-overlay * {
      visibility: visible !important;
    }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add('numa-scanner-active');
}

function removeTransparencyStyles() {
  document.documentElement.classList.remove('numa-scanner-active');
  const style = document.getElementById(SCANNER_TRANSPARENCY_STYLE_ID);
  if (style) style.remove();
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onDetected,
  title = 'Escanear código',
}) {
  const isCapacitorEnv = isCapacitor();

  const videoRef    = useRef(null);   // solo web
  const controlsRef = useRef(null);   // ZXing controls (web) | BarcodeScanner (capacitor)
  const cooldownRef = useRef(false);
  const toastTimerRef = useRef(null);

  const [lastCode,    setLastCode]    = useState('');
  const [scanCount,   setScanCount]   = useState(0);
  const [cameraErr,   setCameraErr]   = useState('');
  const [starting,    setStarting]    = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  /* ── Toast azul "Código leído con éxito" ────────────────────────────────── */
  const showToast = useCallback(() => {
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 1800);
  }, []);

  /* ── Callback de resultado (compartido) ─────────────────────────────────── */
  const handleResult = useCallback((code) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 1500);

    setLastCode(code);
    setScanCount(n => n + 1);
    onDetected(code);
    showToast();
    if (navigator.vibrate) navigator.vibrate([70]);
  }, [onDetected, showToast]);

  /* ══════════════════════════════════════════════════════════════════════════
     PATH WEB — ZXing vía getUserMedia
  ══════════════════════════════════════════════════════════════════════════ */
  const startWebScan = useCallback(async (cancelled) => {
    setStarting(true);
    try {
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' },
            width:      { ideal: 1280 },
            height:     { ideal: 720 },
          },
        },
        videoRef.current,
        (result, _err) => {
          if (result && !cancelled.value) handleResult(result.getText());
        }
      );

      if (cancelled.value) { try { controls.stop(); } catch (_) {} return; }
      controlsRef.current = controls;
    } catch (e) {
      if (cancelled.value) return;
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('permission') || msg.includes('notallowed') || msg.includes('denied')) {
        setCameraErr('Permiso de cámara denegado. Habilítalo en la configuración del navegador.');
      } else if (msg.includes('notfound') || msg.includes('devicesnotfound')) {
        setCameraErr('No se encontró ninguna cámara en este dispositivo.');
      } else {
        setCameraErr('No se pudo iniciar la cámara. Cierra y vuelve a intentarlo.');
      }
    } finally {
      if (!cancelled.value) setStarting(false);
    }
  }, [handleResult]);

  const stopWebScan = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch (_) {}
      controlsRef.current = null;
    }
  }, []);

  /* ══════════════════════════════════════════════════════════════════════════
     PATH CAPACITOR — ML Kit nativo de Android
  ══════════════════════════════════════════════════════════════════════════ */
  const startCapacitorScan = useCallback(async (cancelled) => {
    setStarting(true);
    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');

      if (cancelled.value) return;

      /* 1 ── Permiso nativo de cámara (diálogo del SO, no del WebView) ──── */
      const { camera } = await BarcodeScanner.checkPermissions();
      if (camera !== 'granted') {
        const { camera: nuevoPerm } = await BarcodeScanner.requestPermissions();
        if (nuevoPerm !== 'granted') {
          setCameraErr(
            'Permiso de cámara denegado. ' +
            'Ve a Configuración → Aplicaciones → NUMA → Permisos para habilitarlo.'
          );
          setStarting(false);
          return;
        }
      }

      if (cancelled.value) return;

      /* 2 ── Forzar transparencia en TODA la cadena de ancestros ─────────
         Esto es lo que faltaba: antes solo se ponía transparente html/body,
         pero el div#root (u otro wrapper con bg sólido de Tailwind) seguía
         tapando la cámara nativa. Ver injectTransparencyStyles() arriba.
      ───────────────────────────────────────────────────────────────────── */
      injectTransparencyStyles();

      /* 3 ── Listener de resultados ───────────────────────────────────── */
      await BarcodeScanner.addListener('barcodeScanned', (event) => {
        if (!cancelled.value) handleResult(event.barcode.rawValue);
      });

      /* 4 ── Iniciar escaneo nativo ───────────────────────────────────── */
      const formats = await getCapacitorFormats();
      await BarcodeScanner.startScan({ formats });

      controlsRef.current = BarcodeScanner;

    } catch (e) {
      if (cancelled.value) return;
      console.error('[BarcodeScannerModal] Error Capacitor ML Kit:', e);
      setCameraErr('No se pudo iniciar el escáner. Intenta de nuevo.');
    } finally {
      if (!cancelled.value) setStarting(false);
    }
  }, [handleResult]);

  const stopCapacitorScan = useCallback(async () => {
    removeTransparencyStyles();

    try {
      const { BarcodeScanner } = await import('@capacitor-mlkit/barcode-scanning');
      await BarcodeScanner.stopScan();
      await BarcodeScanner.removeAllListeners();
    } catch (_) {}

    controlsRef.current = null;
  }, []);

  /* ── Effect principal: start/stop según isOpen ──────────────────────────── */
  useEffect(() => {
    if (!isOpen) return;

    setLastCode('');
    setScanCount(0);
    setCameraErr('');
    setToastVisible(false);
    cooldownRef.current = false;

    const cancelled = { value: false };

    if (isCapacitorEnv) {
      startCapacitorScan(cancelled);
    } else {
      startWebScan(cancelled);
    }

    return () => {
      cancelled.value = true;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (isCapacitorEnv) {
        stopCapacitorScan();
      } else {
        stopWebScan();
      }
    };
  }, [isOpen, isCapacitorEnv, startWebScan, stopWebScan, startCapacitorScan, stopCapacitorScan]);

  if (!isOpen) return null;

  return (
    <>
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

        @keyframes numaToastIn {
          from { opacity: 0; transform: translate(-50%, -12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes numaToastOut {
          from { opacity: 1; transform: translate(-50%, 0); }
          to   { opacity: 0; transform: translate(-50%, -12px); }
        }
        .numa-toast-enter {
          animation: numaToastIn 0.25s ease-out forwards;
        }
        .numa-toast-exit {
          animation: numaToastOut 0.25s ease-in forwards;
        }
      `}</style>

      {/*
        Web:       bg-black (el video cubre toda el área de cámara)
        Capacitor: transparente — el fix de transparencia de ancestros se
                   aplica vía injectTransparencyStyles(), este div también
                   debe ser transparente para no tapar la cámara nativa.
      */}
      <div
        className="numa-scanner-overlay fixed inset-0 z-[350] flex flex-col"
        style={{
          touchAction:     'none',
          backgroundColor: isCapacitorEnv ? 'transparent' : 'black',
        }}
      >

        {/* ── Toast "Código leído con éxito" ──────────────────────────────── */}
        {toastVisible && (
          <div
            className={`absolute top-20 left-1/2 z-[400] ${toastVisible ? 'numa-toast-enter' : 'numa-toast-exit'}`}
            style={{ transform: 'translateX(-50%)' }}
          >
            <div className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-full shadow-lg shadow-black/30">
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              <span className="text-[13px] font-semibold whitespace-nowrap">
                Código leído con éxito
              </span>
            </div>
          </div>
        )}

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          className="relative z-10 flex items-center justify-between px-4 py-4 shrink-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.88) 0%, transparent 100%)' }}
        >
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

        {/* ── Área de cámara ──────────────────────────────────────────────── */}
        <div className="flex-1 relative overflow-hidden">

          {!isCapacitorEnv && (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
              autoPlay
            />
          )}

          {/* Marco del visor */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative" style={{ width: 268, height: 158 }}>
              <div className="absolute top-0 left-0 w-6 h-6 border-t-[3px] border-l-[3px] border-white/90 rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-[3px] border-r-[3px] border-white/90 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-[3px] border-l-[3px] border-white/90 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-[3px] border-r-[3px] border-white/90 rounded-br" />
              <div className="numa-scan-line" />
            </div>
          </div>

          {/* Spinner de inicio */}
          {starting && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <span className="material-symbols-outlined text-white text-[44px] animate-spin">
                progress_activity
              </span>
              <p className="text-white/70 text-[13px]">
                {isCapacitorEnv ? 'Solicitando permiso de cámara…' : 'Iniciando cámara…'}
              </p>
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

        {/* ── Footer: último código escaneado ─────────────────────────────── */}
        <div
          className="px-5 py-5 shrink-0 min-h-[100px] flex flex-col justify-center gap-2"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)' }}
        >
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