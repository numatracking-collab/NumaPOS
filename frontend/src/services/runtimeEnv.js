/* ═══════════════════════════════════════════════════════════════════════════
   runtimeEnv.js
   ───────────────────────────────────────────────────────────────────────────
   Detecta en qué "cascarón" está corriendo el frontend:
     - 'electron'    → app de escritorio Windows (impresión por USB)
     - 'capacitor'   → app Android empaquetada (impresión por BT nativo)
     - 'web'         → navegador normal (impresión por Web Bluetooth, el
                        comportamiento que ya tienes hoy y que NO cambia)
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