/* ═══════════════════════════════════════════════════════════════════════════
   printerService.js  —  Servicio de impresión BLE / Windows
   ═══════════════════════════════════════════════════════════════════════════ */

import { buildSaleTicket } from './ticketBuilder';

/* ── Perfiles BLE de impresoras térmicas conocidas ───────────────────────
   Ordenados por prioridad: tu Ofichido primero, luego genéricos.
   ──────────────────────────────────────────────────────────────────────── */
export const PRINTER_PROFILES = [
  { service: '0000fff0-0000-1000-8000-00805f9b34fb', chr: '0000fff2-0000-1000-8000-00805f9b34fb' },
  { service: '0000ff80-0000-1000-8000-00805f9b34fb', chr: '0000ff82-0000-1000-8000-00805f9b34fb' },
  { service: '49535343-fe7d-4ae5-8fa9-9fafd205e455', chr: '49535343-8841-43f4-a8d4-ecbe34729bb3' },
  { service: '000018f0-0000-1000-8000-00805f9b34fb', chr: '00002af1-0000-1000-8000-00805f9b34fb' },
  { service: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', chr: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' },
];

export const PRINTER_SERVICE_UUIDS = PRINTER_PROFILES.map(p => p.service);

/* ── Caché de dispositivos y perfiles ────────────────────────────────── */
const _deviceCache  = new Map();
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
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.info(`[Printer] Conectando GATT (intento ${attempt}/3)...`);
      server = await btRef.gatt.connect();
      await sleep(500);
      console.info('[Printer] Conexión GATT establecida');
      return server;
    } catch (e) {
      lastError = e;
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
  const CHUNK_SIZE  = 20;
  const CHUNK_DELAY = 120;
  const WRITE_TIMEOUT = 5000;

  const useWrite = chr.properties.write;

  console.info(
    `[Printer] Enviando ${data.length} bytes en chunks de ${CHUNK_SIZE}` +
    ` (método: ${useWrite ? 'writeValue' : 'writeWithoutResponse'})`
  );

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
        console.info('[Printer] GATT caído a mitad — reconectando...');
        try {
          try { btRef.gatt.disconnect(); } catch { /* noop */ }
          await sleep(800);
          const server = await withTimeout(btRef.gatt.connect(), 5000, 'reconexión mid-transfer');
          await sleep(300);
          _profileCache.delete(address);
          chr = await findWritableCharacteristic(server, address);
          console.info('[Printer] Reconectado, reintentando chunk...');

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

async function sendBytes(btRef, data, address) {
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

/* ═══════════════════════════════════════════════════════════════════════════
   sendToPrinterDirect  —  Envío directo para la prueba del modal
   ═══════════════════════════════════════════════════════════════════════════ */
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
   getActivePrinter  —  Busca la impresora con autoPrint habilitado
   ═══════════════════════════════════════════════════════════════════════════ */
async function getActivePrinter() {
  let devices = [];
  try { devices = JSON.parse(localStorage.getItem('pos_devices') || '[]'); } catch { return null; }

  const printer = devices.find(d => d.config?.autoPrint === true);
  if (!printer) return null;
  if (printer.connectionType === 'windows') return { device: printer, btRef: null };

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

/* ── Utilidad interna: construir saleData y enviar a la impresora ─────── */
async function _sendTicket(saleData, device, btRef) {
  const width = device.config?.ticketWidth ?? '58';
  const bytes = buildSaleTicket(saleData, width);

  if (device.connectionType === 'bluetooth') {
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
   printSaleTicket  —  Imprime al terminar una NUEVA venta (desde CheckoutModal)
   ═══════════════════════════════════════════════════════════════════════════ */
export async function printSaleTicket(saleResponse, extra = {}) {
  try {
    const result = await getActivePrinter();
    if (!result) return { ok: false, error: 'No hay impresora con impresión automática habilitada.' };

    const { device, btRef } = result;

    const saleData = {
      folio:          saleResponse.folio              ?? '',
      created_at:     saleResponse.sale?.created_at   ?? new Date().toISOString(),
      payment_method: extra.paymentMethod             ?? saleResponse.payment_method ?? 'cash',
      amount_paid:    extra.amountPaid                ?? saleResponse.amount_paid    ?? extra.total ?? 0,
      change:         saleResponse.change             ?? 0,
      total:          extra.total                     ?? 0,
      subtotal:       extra.total                     ?? 0,
      discount:       0,
      items: (extra.cart ?? []).map(i => ({
        sku:      i.sku      ?? '',
        name:     i.name     ?? '',
        quantity: i.quantity ?? 1,
        price:    i.price    ?? 0,
      })),
      cashier: extra.cashier ?? '',
      caja:    extra.caja    ?? '',
    };

    return await _sendTicket(saleData, device, btRef);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   reprintSaleTicket  —  Reimprime desde el Historial de ventas
   Acepta el objeto sale + items tal como los devuelve salesService.get(id).
   ═══════════════════════════════════════════════════════════════════════════ */
export async function reprintSaleTicket(sale, items = []) {
  try {
    const result = await getActivePrinter();
    if (!result) return { ok: false, error: 'No hay impresora con impresión automática habilitada.' };

    const { device, btRef } = result;

    const total = Number(sale.total_amount ?? 0);

    const saleData = {
      folio:          sale.folio          ?? '',
      created_at:     sale.created_at     ?? new Date().toISOString(),
      payment_method: sale.payment_method ?? 'cash',
      amount_paid:    total,                          // en reimpresión no tenemos el monto pagado
      change:         0,
      total,
      subtotal:       total,
      discount:       0,
      items: items.map(i => ({
        sku:      i.sku        ?? '',
        name:     i.name       ?? '',
        quantity: Number(i.quantity   ?? 1),
        price:    Number(i.unit_price ?? 0),          // campo del detalle de venta
      })),
      cashier: sale.cashier_name ?? sale.user_name ?? '',
      caja:    sale.caja_name    ?? '',
    };

    return await _sendTicket(saleData, device, btRef);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   cacheBtDevice  —  Guarda referencia viva del dispositivo BT
   ═══════════════════════════════════════════════════════════════════════════ */
export function cacheBtDevice(address, btDevice) {
  if (address && btDevice) _deviceCache.set(address, btDevice);
}

/* ── Utilidad ─────────────────────────────────────────────────────────── */
function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}