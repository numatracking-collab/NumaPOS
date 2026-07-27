/* ═══════════════════════════════════════════════════════════════════════════
   printerService.js  —  Servicio de impresión BLE / Windows
   ───────────────────────────────────────────────────────────────────────────
   FASE 3 — Soporte Electron (Windows, cola de impresión del sistema)

   Entornos soportados:
     - web       → navigator.bluetooth (Web Bluetooth API)
     - capacitor → capacitorBtAdapter.js (BLE nativo Android)
     - electron  → electronPrinterAdapter.js (IPC → main process → Spooler)
   ═══════════════════════════════════════════════════════════════════════════ */

import { buildSaleTicket } from './ticketBuilder';
import { isCapacitor, isElectron } from './runtimeEnv';
import * as capBt from './capacitorBtAdapter';
import * as elPrinter from './electronPrinterAdapter';

/* ── Perfiles BLE de impresoras térmicas conocidas ───────────────────────── */
export const PRINTER_PROFILES = [
  { service: '0000fff0-0000-1000-8000-00805f9b34fb', chr: '0000fff2-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff80-0000-1000-8000-00805f9b34fb', chr: '0000ff82-0000-1000-8000-00805f9b34fb' },
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', chr: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
  { service: '000018f0-0000-1000-8000-00805f9b34fb', chr: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chr: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
];

export const PRINTER_SERVICE_UUIDS = PRINTER_PROFILES.map(p => p.service);

/* ── Caché de dispositivos y perfiles (rama WEB) ─────────────────────────── */
const _deviceCache = new Map();
const _profileCache = new Map();

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers internos
   ═══════════════════════════════════════════════════════════════════════════ */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)
    ),
  ]);
}

function normalizeTimestamp(ts) {
  if (!ts) return new Date().toISOString();
  const s = String(ts);
  if (s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s)) return s;
  return s.replace(' ', 'T') + 'Z';
}

function buildOfferLabel(offerType, item = {}) {
  switch (offerType) {
    case '2x1': return '2 × 1';
    case '3x2': return '3 × 2';
    case 'nxm': return `Compra ${item.buy_qty || '?'} llévate ${item.get_qty || '?'}`;
    case 'mitad': return '½ Precio';
    case 'descuento': return item.offer_name ? `${item.offer_name}` : 'Descuento';
    default: return offerType || 'PROMO';
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ═══════════════════════════════════════════════════════════════════════════
   ── RAMA WEB ── (Web Bluetooth API — código original, sin cambios)
   ═══════════════════════════════════════════════════════════════════════════ */

async function findWritableCharacteristic(server, address) {
  const cached = _profileCache.get(address);
  if (cached) {
    try {
      const svc = await withTimeout(server.getPrimaryService(cached.service), 3000, 'getPrimaryService cached');
      const chr = await withTimeout(svc.getCharacteristic(cached.chr), 3000, 'getCharacteristic cached');
      if (chr.properties.write || chr.properties.writeWithoutResponse) return chr;
    } catch (e) {
      console.warn('[Printer] Perfil cacheado falló:', e.message);
    }
    _profileCache.delete(address);
  }

  for (const profile of PRINTER_PROFILES) {
    try {
      const svc = await withTimeout(
        server.getPrimaryService(profile.service), 3000, `getPrimaryService ${profile.service}`
      );
      let chr = null;

      try {
        const c = await withTimeout(
          svc.getCharacteristic(profile.chr), 3000, `getCharacteristic ${profile.chr}`
        );
        if (c.properties.write || c.properties.writeWithoutResponse) chr = c;
      } catch {
        try {
          const all = await withTimeout(svc.getCharacteristics(), 3000, 'getCharacteristics');
          chr = all.find(c => c.properties.write || c.properties.writeWithoutResponse) ?? null;
        } catch { /* noop */ }
      }

      if (chr) {
        _profileCache.set(address, { service: profile.service, chr: chr.uuid });
        console.info(`[Printer] Perfil encontrado → service: ${profile.service} chr: ${chr.uuid}`);
        return chr;
      }
    } catch (e) {
      console.warn(`[Printer] Servicio ${profile.service} falló:`, e.message);
    }
  }

  throw new Error(
    'No se encontró servicio de impresión compatible. ' +
    'Verifica que la impresora esté encendida y en rango.'
  );
}

async function ensureConnection(btRef, address) {
  if (btRef.gatt.connected) {
    console.info('[Printer] Conexión GATT activa, reutilizando');
    return btRef.gatt;
  }

  try { btRef.gatt.disconnect(); } catch { /* noop */ }
  await sleep(800);

  let server = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.info(`[Printer] Conectando GATT (intento ${attempt}/3)...`);
      server = await btRef.gatt.connect();
      await sleep(500);
      console.info('[Printer] Conexión GATT establecida');
      return server;
    } catch (e) {
      console.warn(`[Printer] Intento ${attempt}/3 fallido:`, e.message);
      if (attempt < 3) await sleep(1500 * attempt);
    }
  }

  _deviceCache.delete(address);
  _profileCache.delete(address);
  throw new Error(
    'Impresora desconectada. Abre Ajustes → Dispositivos, ' +
    'toca el ícono de actualizar junto a la impresora e intenta de nuevo.'
  );
}

async function writeChunked(chr, data, btRef, address) {
  const CHUNK_SIZE = 20;
  const CHUNK_DELAY = 120;
  const WRITE_TIMEOUT = 5000;
  const useWrite = chr.properties.write;

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);

    const writeWithTimeout = (writeFn) =>
      Promise.race([
        writeFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout en chunk offset ${offset}`)), WRITE_TIMEOUT)
        ),
      ]);

    let success = false;

    try {
      if (useWrite) {
        await writeWithTimeout(() => chr.writeValue(chunk));
      } else {
        await writeWithTimeout(() => chr.writeValueWithoutResponse(chunk));
      }
      success = true;
    } catch (e) {
      console.warn(`[Printer] Write falló en offset ${offset}:`, e.message);

      if (e.message?.includes('disconnected') || e.message?.includes('GATT')) {
        try {
          try { btRef.gatt.disconnect(); } catch { /* noop */ }
          await sleep(800);
          const server = await withTimeout(btRef.gatt.connect(), 5000, 'reconexión mid-transfer');
          await sleep(300);
          _profileCache.delete(address);
          chr = await findWritableCharacteristic(server, address);

          if (useWrite) {
            await writeWithTimeout(() => chr.writeValue(chunk));
          } else {
            await writeWithTimeout(() => chr.writeValueWithoutResponse(chunk));
          }
          success = true;
        } catch (reconnErr) {
          throw new Error(`GATT se desconectó en offset ${offset} y no se pudo reconectar: ${reconnErr.message}`);
        }
      }
    }

    if (!success) {
      try {
        if (useWrite) {
          await writeWithTimeout(() => chr.writeValueWithoutResponse(chunk));
        } else {
          await writeWithTimeout(() => chr.writeValue(chunk));
        }
      } catch (e2) {
        throw new Error(`Error al enviar datos en offset ${offset}/${data.length}: ${e2.message}`);
      }
    }

    if (offset + CHUNK_SIZE < data.length) {
      await sleep(CHUNK_DELAY);
    }
  }

  console.info('[Printer] Envío completo');
}

async function sendBytesWeb(btRef, data, address) {
  const server = await ensureConnection(btRef, address);
  try {
    const chr = await findWritableCharacteristic(server, address);
    await writeChunked(chr, data, btRef, address);
  } catch (e) {
    _profileCache.delete(address);
    console.error('[Printer] Error durante envío:', e.message);
    throw e;
  }
}

export async function sendToPrinterDirect(btDevice, data) {
  let server;
  if (btDevice.gatt.connected) {
    server = btDevice.gatt;
  } else {
    try {
      server = await btDevice.gatt.connect();
      await sleep(300);
    } catch (e) {
      throw new Error(`No se pudo conectar al GATT: ${e.message}`);
    }
  }
  const address = btDevice.id ?? btDevice.name ?? 'test';
  const chr = await findWritableCharacteristic(server, address);
  await writeChunked(chr, data);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ── RAMA CAPACITOR ──
   ═══════════════════════════════════════════════════════════════════════════ */
async function sendBytesCapacitor(address, data) {
  await capBt.writeBytes(address, data);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ── RAMA ELECTRON ──
   En Electron, "address" es el nombre de la impresora en Windows
   (ej. "Termica58" o "\\PC-CAJA\Termica58"), guardado en device.address.
   Los bytes ESC/POS se mandan al main process via IPC y desde ahí al
   Spooler de Windows — sin chunks, sin GATT, sin BLE.
   ═══════════════════════════════════════════════════════════════════════════ */
async function sendBytesElectron(printerName, data) {
  await elPrinter.writeBytes(printerName, data);
}

/* ── Despachador único ───────────────────────────────────────────────────── */
async function sendBytes(btRef, data, address) {
  if (isElectron()) {
    await sendBytesElectron(address, data);
  } else if (isCapacitor()) {
    await sendBytesCapacitor(address, data);
  } else {
    await sendBytesWeb(btRef, data, address);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   getActivePrinter
   ═══════════════════════════════════════════════════════════════════════════ */
async function getActivePrinter() {
  let devices = [];
  try { devices = JSON.parse(localStorage.getItem('pos_devices') || '[]'); } catch { return null; }

  const printer = devices.find(d => d.config?.autoPrint === true);
  if (!printer) return null;

  // En Electron, tanto 'windows' como 'bluetooth' usan el nombre de impresora
  // guardado en printer.address — no hay objeto btRef que resolver.
  if (isElectron()) {
    return { device: printer, btRef: null };
  }

  if (printer.connectionType === 'windows') return { device: printer, btRef: null };

  if (isCapacitor()) {
    return { device: printer, btRef: null };
  }

  let btRef = _deviceCache.get(printer.address) ?? null;

  if (!btRef && navigator.bluetooth?.getDevices) {
    try {
      const known = await navigator.bluetooth.getDevices();
      btRef = known.find(d =>
        d.id === printer.address || d.name === printer.address
      ) ?? null;
      if (btRef) {
        _deviceCache.set(printer.address, btRef);
        console.info('[Printer] Dispositivo recuperado via getDevices()');
      }
    } catch (e) {
      console.warn('[Printer] getDevices() falló:', e.message);
    }
  }

  return { device: printer, btRef };
}

/* ── Enviar ticket ───────────────────────────────────────────────────────── */
async function _sendTicket(saleData, device, btRef) {
  const width = device.config?.ticketWidth ?? '58';
  const bytes = buildSaleTicket(saleData, width);

  if (isElectron()) {
    // En Electron toda impresora (USB o red) se identifica por nombre en Windows
    if (!device.address) {
      return {
        ok: false,
        error: 'No hay impresora configurada. Abre Ajustes → Dispositivos y agrega una.',
      };
    }
    try {
      await sendBytes(null, bytes, device.address);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  if (device.connectionType === 'bluetooth') {
    if (isCapacitor()) {
      if (!device.address) {
        return {
          ok: false,
          error: 'Impresora no encontrada. Abre Ajustes → Dispositivos y vuelve a vincularla.',
        };
      }
      try {
        await sendBytes(null, bytes, device.address);
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    }

    if (!btRef) {
      return {
        ok: false,
        error: 'Impresora no encontrada. Abre Ajustes → Dispositivos y vuelve a vincularla.',
      };
    }
    await sendBytes(btRef, bytes, device.address);
    return { ok: true };
  }

  if (device.connectionType === 'windows') {
    return { ok: true };
  }

  return { ok: false, error: 'Tipo de conexión no reconocido.' };
}

/* ═══════════════════════════════════════════════════════════════════════════
   API PÚBLICA
   ═══════════════════════════════════════════════════════════════════════════ */

export async function printSaleTicket(saleData) {
  try {
    const result = await getActivePrinter();
    if (!result) return { ok: false, error: 'No hay impresora con impresión automática habilitada.' };
    const { device, btRef } = result;
    return await _sendTicket(saleData, device, btRef);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function reprintSaleTicket(sale, items = []) {
  try {
    const result = await getActivePrinter();
    if (!result) return { ok: false, error: 'No hay impresora con impresión automática habilitada.' };

    const { device, btRef } = result;
    const total = Number(sale.total_amount ?? 0);

    const saleData = {
      folio: sale.folio ?? '',
      created_at: normalizeTimestamp(sale.created_at),
      payment_method: sale.payment_method ?? 'cash',
      amount_paid: Number(sale.amount_paid ?? total),
      change: Number(sale.change_amount ?? sale.change ?? 0),
      total,
      subtotal: total,
      discount: 0,
      customer_name: sale.customer_name ?? '',
      cashier: sale.cashier_name ?? '',
      caja: sale.caja_name ?? '',
      items: items.map(i => {
        const discount = Number(i.discount_amount ?? 0);
        return {
          sku: i.sku ?? '',
          name: i.product_name ?? i.name ?? '',
          quantity: Number(i.quantity ?? 1),
          price: Number(i.unit_price ?? 0),
          discount_amount: discount,
          offer_label: i.offer_type ? buildOfferLabel(i.offer_type, i) : null,
        };
      }),
    };

    return await _sendTicket(saleData, device, btRef);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function cacheBtDevice(address, btDevice) {
  if (isCapacitor() || isElectron()) return; // no-op en entornos nativos
  if (address && btDevice) _deviceCache.set(address, btDevice);
}

/* ═══════════════════════════════════════════════════════════════════════════
   reconnectBTPrinters
   ─────────────────────────────────────────────────────────────────────────
   ELECTRON: las impresoras Windows no necesitan "reconexión" — el Spooler
   de Windows maneja la conexión física. Esta función es un no-op en ese
   entorno (retorna inmediatamente sin errores).
   ═══════════════════════════════════════════════════════════════════════════ */
export async function reconnectBTPrinters() {
  // En Electron no hay BLE que reconectar
  if (isElectron()) {
    _btWatcherStatus.missingDevices = [];
    _btWatcherStatus.lastCheckedAt = Date.now();
    return;
  }

  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('pos_devices') || '[]');
  } catch { return; }

  const btPrinters = saved.filter(d => d.connectionType === 'bluetooth' && d.address);
  if (btPrinters.length === 0) {
    _btWatcherStatus.missingDevices = [];
    return;
  }

  if (isCapacitor()) {
    const missing = [];
    for (const printer of btPrinters) {
      try {
        await capBt.connect(printer.address);
        console.info(`[BT] ✓ Auto-reconectado (Capacitor): ${printer.name}`);
      } catch (e) {
        console.info(`[BT] No se pudo conectar "${printer.name}": ${e.message}`);
        missing.push(printer);
      }
    }
    _btWatcherStatus.missingDevices = missing;
    _btWatcherStatus.lastCheckedAt = Date.now();
    _notifyBTWatcherListeners();
    return;
  }

  // ── Rama WEB ──────────────────────────────────────────────────────────
  if (!navigator.bluetooth?.getDevices) {
    console.info('[BT] getDevices no disponible en este navegador.');
    return;
  }

  try {
    const known = await navigator.bluetooth.getDevices();
    const missing = [];

    for (const printer of btPrinters) {
      const found = known.find(
        d => d.id === printer.address || d.name === printer.address
      );

      if (!found) {
        missing.push(printer);
        continue;
      }

      try {
        if (!found.gatt.connected) {
          try { found.gatt.disconnect(); } catch { /* noop */ }
          await new Promise(r => setTimeout(r, 400));
        }
        await found.gatt.connect();
        cacheBtDevice(printer.address, found);
        console.info(`[BT] ✓ Auto-reconectado: ${printer.name}`);
      } catch (e) {
        console.info(`[BT] No se pudo conectar "${printer.name}": ${e.message}`);
        missing.push(printer);
      }
    }

    _btWatcherStatus.missingDevices = missing;
    _btWatcherStatus.lastCheckedAt = Date.now();
    _notifyBTWatcherListeners();
  } catch (e) {
    console.info('[BT] Error en getDevices():', e.message);
  }
}

/* ── BT Watcher ──────────────────────────────────────────────────────────── */
let _watcherStarted = false;
let _reconnecting = false;

const _btWatcherStatus = {
  missingDevices: [],
  lastCheckedAt: null,
};

const _btWatcherListeners = new Set();

function _notifyBTWatcherListeners() {
  for (const cb of _btWatcherListeners) {
    try { cb({ ..._btWatcherStatus }); } catch { /* noop */ }
  }
}

export function startBTWatcher() {
  if (_watcherStarted) return;
  if (typeof document === 'undefined') return;
  _watcherStarted = true;

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    if (_reconnecting) return;
    _reconnecting = true;
    try {
      await reconnectBTPrinters();
    } finally {
      _reconnecting = false;
    }
  });

  console.info('[BT] Watcher de reconexión activado (visibilitychange).');
}

export function onBTWatcherStatusChange(callback) {
  if (typeof callback !== 'function') return () => {};
  _btWatcherListeners.add(callback);
  return () => _btWatcherListeners.delete(callback);
}

export function getBTWatcherStatus() {
  return { ..._btWatcherStatus };
}

/* ═══════════════════════════════════════════════════════════════════════════
   scanForPrinter
   ─────────────────────────────────────────────────────────────────────────
   ELECTRON: no hay escáner BLE. El modal llama getPrinters() del adapter
   para listar las impresoras instaladas en Windows y el usuario elige una.
   Esta función en Electron no tiene sentido — el modal no la llama en ese
   entorno (ver PrinterSetupModal.jsx rama Electron).
   ═══════════════════════════════════════════════════════════════════════════ */
export async function scanForPrinter() {
  if (isCapacitor()) {
    const device = await capBt.requestDevice();
    return { id: device.deviceId, name: device.name, raw: null };
  }

  if (!navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth no está disponible. Usa Chrome en Android (v56+). ' +
      'En iOS no está soportado.'
    );
  }
  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });
  return { id: device.id ?? device.name ?? '', name: device.name ?? 'Impresora', raw: device };
}

/* ═══════════════════════════════════════════════════════════════════════════
   sendTestTicket
   ─────────────────────────────────────────────────────────────────────────
   ELECTRON: manda los bytes directamente al adapter por IPC.
   ═══════════════════════════════════════════════════════════════════════════ */
export async function sendTestTicket(address, rawDevice, bytes) {
  if (isElectron()) {
    await elPrinter.writeBytes(address, bytes);
    return;
  }
  if (isCapacitor()) {
    await capBt.writeBytes(address, bytes);
    return;
  }
  if (!rawDevice) {
    throw new Error('No hay dispositivo Bluetooth vinculado.');
  }
  await sendToPrinterDirect(rawDevice, bytes);
}

/* ═══════════════════════════════════════════════════════════════════════════
   getWindowsPrinters  —  Exportado para que PrinterSetupModal lo use
   en la rama Electron para mostrar el selector de impresoras del sistema.
   ═══════════════════════════════════════════════════════════════════════════ */
export async function getWindowsPrinters() {
  return elPrinter.getPrinters();
}