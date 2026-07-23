/* ═══════════════════════════════════════════════════════════════════════════
   runtimeEnv.js
   Detecta en qué "cascarón" está corriendo el frontend:
     'electron'  → app de escritorio Windows  (impresión por USB)
     'capacitor' → app Android empaquetada    (BT nativo, cámara nativa, etc.)
     'web'       → navegador normal            (comportamiento por defecto)
   ═══════════════════════════════════════════════════════════════════════════ */

export function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

export function isCapacitor() {
  return typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
}

export function isWeb() {
  return !isElectron() && !isCapacitor();
}

export function getRuntimeEnv() {
  if (isElectron()) return 'electron';
  if (isCapacitor()) return 'capacitor';
  return 'web';
}