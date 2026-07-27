/* ═══════════════════════════════════════════════════════════════════════════
   electronPrinterAdapter.js
   ───────────────────────────────────────────────────────────────────────────
   Adapter de impresión para el entorno Electron (Windows).
   Interfaz paralela a capacitorBtAdapter.js — mismas operaciones pero
   traducidas a window.electronAPI (el bridge IPC definido en preload.cjs).

   printerService.js lo importa y lo usa cuando isElectron() === true,
   exactamente igual que usa capacitorBtAdapter cuando isCapacitor() === true.
   El resto del código (ticketBuilder.js, CheckoutModal, etc.) no cambia.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   writeBytes
   ───────────────────────────────────────────────────────────────────────────
   Envía los bytes ESC/POS a la impresora de Windows indicada.

   @param {string}     printerName  Nombre de la impresora en Windows
                                    (ej. "Termica58" o "\\PC-CAJA\Termica58")
   @param {Uint8Array} data         Bytes ya construidos por ticketBuilder.js
   @returns {Promise<void>}
   ═══════════════════════════════════════════════════════════════════════════ */
export async function writeBytes(printerName, data) {
    if (!window.electronAPI?.print) {
        throw new Error(
            'electronAPI no está disponible. ' +
            'Verifica que la app esté corriendo dentro de Electron.'
        );
    }

    const result = await window.electronAPI.print(printerName, data);

    if (!result.ok) {
        throw new Error(result.error || 'Error desconocido al imprimir.');
    }
}

/* ═══════════════════════════════════════════════════════════════════════════
   getPrinters
   ───────────────────────────────────────────────────────────────────────────
   Lista las impresoras instaladas en Windows.
   Usado por PrinterSetupModal en la rama Electron para mostrar un selector
   en vez del escáner BLE (en Windows el usuario elige por nombre, no
   emparejando por Bluetooth).

   @returns {Promise<Array<{name: string, isDefault: boolean, status: number}>>}
   ═══════════════════════════════════════════════════════════════════════════ */
export async function getPrinters() {
    if (!window.electronAPI?.getPrinters) return [];

    const result = await window.electronAPI.getPrinters();
    return result.ok ? result.printers : [];
}

/* ═══════════════════════════════════════════════════════════════════════════
   getDefaultPrinter
   ───────────────────────────────────────────────────────────────────────────
   Devuelve el nombre de la impresora predeterminada de Windows, o null si
   no hay ninguna configurada.

   @returns {Promise<string|null>}
   ═══════════════════════════════════════════════════════════════════════════ */
export async function getDefaultPrinter() {
    if (!window.electronAPI?.getDefaultPrinter) return null;

    const result = await window.electronAPI.getDefaultPrinter();
    return result.ok ? result.name : null;
}