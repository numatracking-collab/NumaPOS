/* ═══════════════════════════════════════════════════════════════════════════
   electron/main.cjs — Proceso principal de Electron (NUMA POS Windows)
   ───────────────────────────────────────────────────────────────────────────
   IMPORTANTE: extensión .cjs porque el proyecto usa "type":"module" en
   package.json (ESM), pero Electron main necesita CommonJS (require).
   ═══════════════════════════════════════════════════════════════════════════ */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// electron-squirrel-startup maneja los eventos del instalador NSIS en Windows
// (accesos directos, desinstalación, etc.) — debe ir antes de todo lo demás.
if (require('electron-squirrel-startup')) app.quit();

/* ── Ruta al dist de Vite ────────────────────────────────────────────────── */
const DIST_PATH = path.join(__dirname, '..', 'dist');

/* ── Referencia a la ventana principal ───────────────────────────────────── */
let mainWindow = null;

/* ═══════════════════════════════════════════════════════════════════════════
   createWindow
   ═══════════════════════════════════════════════════════════════════════════ */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'NUMA POS',
        // Icono de la app en Windows
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        webPreferences: {
            // preload.cjs expone window.electronAPI al renderer de forma segura
            preload: path.join(__dirname, 'preload.cjs'),
            contextIsolation: true,   // seguridad: renderer no accede a Node directamente
            nodeIntegration: false,  // seguridad: renderer no puede llamar require()
            sandbox: false,  // necesario para que preload pueda usar require
        },
    });

    const isDev = process.argv.includes('--dev');
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(DIST_PATH, 'index.html'));
    }

    mainWindow.on('closed', () => { mainWindow = null; });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Ciclo de vida de la app
   ═══════════════════════════════════════════════════════════════════════════ */
app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

/* ═══════════════════════════════════════════════════════════════════════════
   IPC — Impresión
   ───────────────────────────────────────────────────────────────────────────
   El renderer (React) llama window.electronAPI.print(printerName, bytes)
   a través del bridge en preload.cjs. Aquí recibimos esa llamada y
   enviamos los bytes a la impresora de Windows usando pdf-to-printer.

   NOTA sobre pdf-to-printer:
   Esta librería envía PDFs, no bytes ESC/POS crudos. Para impresoras
   térmicas en Windows, el flujo correcto es:
     1. El renderer manda los bytes ESC/POS (Uint8Array → Array normal).
     2. Main los escribe en un archivo .bin temporal.
     3. Se imprime via print() que usa SumatraPDF internamente, O...
     4. Alternativamente, se usa el comando RAW de la API de Windows.
   Usamos el enfoque de archivo temporal + SumatraPDF para máxima
   compatibilidad con impresoras térmicas USB/red sin drivers especiales.
   ─────────────────────────────────────────────────────────────────────── */
ipcMain.handle('printer:print', async (event, { printerName, bytes }) => {
    try {
        const { execFile } = require('child_process');
        const util = require('util');
        const execFileAsync = util.promisify(execFile);

        const buffer = Buffer.from(bytes);
        const tmpDir  = app.getPath('temp');
        const tmpFile = path.join(tmpDir, `numapos_ticket_${Date.now()}.bin`);

        fs.writeFileSync(tmpFile, buffer);

        // PowerShell manda el archivo RAW al spooler por nombre de impresora
        const psScript = `
$bytes = [System.IO.File]::ReadAllBytes('${tmpFile.replace(/\\/g, '\\\\')}')
$stream = [System.Net.Sockets.TcpClient]
Add-Type -AssemblyName System.Drawing
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${printerName.replace(/'/g, "\\'")}'
$rawData = $bytes
$action = [System.Drawing.Printing.PrintPageEventHandler]{
    param($s, $e)
    $e.Graphics  | Out-Null
}
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA")]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter")]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA")]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int Level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter")]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter")]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter")]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter")]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
}
"@
$di = New-Object DOCINFOA
$di.pDocName = "NUMA POS Ticket"
$di.pDataType = "RAW"
$hPrinter = [IntPtr]::Zero
[RawPrinter]::OpenPrinter('${printerName.replace(/'/g, "\\'")}', [ref]$hPrinter, [IntPtr]::Zero) | Out-Null
[RawPrinter]::StartDocPrinter($hPrinter, 1, $di) | Out-Null
[RawPrinter]::StartPagePrinter($hPrinter) | Out-Null
$pBytes = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $pBytes, $bytes.Length)
$written = 0
[RawPrinter]::WritePrinter($hPrinter, $pBytes, $bytes.Length, [ref]$written) | Out-Null
[System.Runtime.InteropServices.Marshal]::FreeHGlobal($pBytes)
[RawPrinter]::EndPagePrinter($hPrinter) | Out-Null
[RawPrinter]::EndDocPrinter($hPrinter) | Out-Null
[RawPrinter]::ClosePrinter($hPrinter) | Out-Null
`;

        await execFileAsync('powershell.exe', [
            '-NoProfile', '-NonInteractive', '-Command', psScript
        ]);

        try { fs.unlinkSync(tmpFile); } catch { /* noop */ }

        return { ok: true };
    } catch (err) {
        console.error('[Electron] Error al imprimir:', err.message);
        return { ok: false, error: err.message };
    }
});

/* ── IPC: listar impresoras instaladas en Windows ────────────────────────── */
ipcMain.handle('printer:list', async () => {
    try {
        // webContents.getPrintersAsync() devuelve las impresoras del sistema
        const printers = await mainWindow.webContents.getPrintersAsync();
        return {
            ok: true,
            printers: printers.map(p => ({
                name: p.name,
                isDefault: p.isDefault,
                status: p.status,
            })),
        };
    } catch (err) {
        return { ok: false, error: err.message, printers: [] };
    }
});

/* ── IPC: obtener impresora predeterminada ───────────────────────────────── */
ipcMain.handle('printer:getDefault', async () => {
    try {
        const printers = await mainWindow.webContents.getPrintersAsync();
        const def = printers.find(p => p.isDefault);
        return { ok: true, name: def?.name ?? null };
    } catch (err) {
        return { ok: false, error: err.message, name: null };
    }
});
