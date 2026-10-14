// ─────────────────────────────────────────────────────────────────────────────
// Versión actual de la app en ejecución.
//   capacitor → versionName real del APK (android/app/build.gradle)
//   electron  → app.getVersion() vía preload (window.electronAPI.getAppVersion)
//   web       → null (no aplica)
// APP_VERSION queda solo como último recurso para Electron si el preload
// todavía no expone getAppVersion.
// ─────────────────────────────────────────────────────────────────────────────
import { isCapacitor, isElectron } from '../services/runtimeEnv';

export const APP_VERSION = '1.6.5'; // fallback; ya no es la fuente principal

export const normalizeVersion = (v) => String(v ?? '').trim().replace(/^v/i, '');

export const isNewerVersion = (remote, local) => {
    const r = normalizeVersion(remote).split('.').map(n => parseInt(n, 10) || 0);
    const l = normalizeVersion(local).split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(r.length, l.length);
    for (let i = 0; i < len; i++) {
        const diff = (r[i] || 0) - (l[i] || 0);
        if (diff > 0) return true;
        if (diff < 0) return false;
    }
    return false;
};

export async function getCurrentVersion() {
    try {
        if (isCapacitor()) {
            const { App } = await import('@capacitor/app');
            const info = await App.getInfo();
            return normalizeVersion(info.version) || null;
        }
        if (isElectron()) {
            if (typeof window.electronAPI.getAppVersion === 'function') {
                const v = await window.electronAPI.getAppVersion();
                return normalizeVersion(v) || null;
            }
            return normalizeVersion(APP_VERSION) || null;
        }
    } catch (err) {
        console.error('[appVersion] No se pudo obtener la versión actual:', err);
    }
    return null;
}