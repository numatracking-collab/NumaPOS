/* ═══════════════════════════════════════════════════════════════════════════
   electron/preload.cjs — Bridge seguro entre renderer y main process
   ───────────────────────────────────────────────────────────────────────────
   Con contextIsolation: true, el renderer (React) NO puede llamar a Node
   directamente. Este archivo corre en un contexto intermedio privilegiado
   y expone SOLO las funciones que el renderer necesita, a través de
   contextBridge.exposeInMainWorld.

   Lo que el renderer ve: window.electronAPI (definido aquí).
   runtimeEnv.js detecta isElectron() comprobando !!window.electronAPI.
   ═══════════════════════════════════════════════════════════════════════════ */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

    /* ── Impresión ──────────────────────────────────────────────────────────
       print(printerName, bytes)
         printerName : string — nombre exacto de la impresora en Windows
                       (ej. "Termica58" o "\\PC-CAJA\Termica58")
         bytes       : Uint8Array — datos ESC/POS ya construidos por ticketBuilder.js
       Returns: Promise<{ ok: boolean, error?: string }>
    ──────────────────────────────────────────────────────────────────────── */
    print: (printerName, bytes) =>
        ipcRenderer.invoke('printer:print', {
            printerName,
            // Uint8Array no cruza el IPC como tal — convertimos a Array normal
            bytes: Array.from(bytes),
        }),

    /* ── Listar impresoras instaladas en Windows ────────────────────────────
       Returns: Promise<{ ok: boolean, printers: Array<{name, isDefault, status}> }>
    ──────────────────────────────────────────────────────────────────────── */
    getPrinters: () =>
        ipcRenderer.invoke('printer:list'),

    /* ── Obtener impresora predeterminada del sistema ───────────────────────
       Returns: Promise<{ ok: boolean, name: string|null }>
    ──────────────────────────────────────────────────────────────────────── */
    getDefaultPrinter: () =>
        ipcRenderer.invoke('printer:getDefault'),

});
