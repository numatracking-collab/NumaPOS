/* ═══════════════════════════════════════════════════════════════════════════
   printerService.js
   Servicio singleton para impresión desde el POS.

   Uso:
     import { printSaleTicket } from '../services/printerService';
     await printSaleTicket(saleResponse, { cart, total, cashier, caja });
═══════════════════════════════════════════════════════════════════════════ */

import { buildSaleTicket } from './ticketBuilder';

/* ── UUIDs del servicio BLE / SPP ────────────────────────────────────── */
const BLE_SERVICE   = '000018f0-0000-1000-8000-00805f9b34fb';
const BLE_WRITE_CHR = '00002af1-0000-1000-8000-00805f9b34fb';
const SPP_SERVICE   = '00001101-0000-1000-8000-00805f9b34fb';

/* ── Caché de BluetoothDevice en memoria (se pierde al recargar) ─────── */
const _deviceCache = new Map(); // deviceId → BluetoothDevice

/* ══════════════════════════════════════════════════════════════════════════
   getActivePrinter()
   Lee pos_devices de localStorage y devuelve el primer dispositivo
   que tenga autoPrint: true.
   @returns {{ device: object, btRef: BluetoothDevice|null } | null}
════════════════════════════════════════════════════════════════════════════ */
async function getActivePrinter() {
  let devices = [];
  try {
    devices = JSON.parse(localStorage.getItem('pos_devices') || '[]');
  } catch { return null; }

  const printer = devices.find(d => d.config?.autoPrint === true);
  if (!printer) return null;

  if (printer.connectionType === 'windows') {
    return { device: printer, btRef: null };
  }

  // Solo usar caché — getDevices() no disponible en este entorno
  const btRef = _deviceCache.get(printer.address) ?? null;
  return { device: printer, btRef };
}

/* ══════════════════════════════════════════════════════════════════════════
   sendBytes(btRef, data)
   Envía un Uint8Array a la impresora Bluetooth.
════════════════════════════════════════════════════════════════════════════ */
async function sendBytes(btRef, data) {
  const CHUNK = 512;
  let server = null;

  // Si ya está conectado, reusar; si no, conectar
  try {
    server = btRef.gatt.connected
      ? btRef.gatt          // ya conectado, reusar directamente
      : await btRef.gatt.connect();
  } catch (e) {
    // Referencia muerta — limpiar caché para forzar re-vinculación
    _deviceCache.forEach((v, k) => { if (v === btRef) _deviceCache.delete(k); });
    throw new Error('La impresora se desconectó. Abre Dispositivos y vincúlala de nuevo.');
  }

  try {
    const svc = await server.getPrimaryService(BLE_SERVICE);
    const chr = await svc.getCharacteristic(BLE_WRITE_CHR);
    for (let i = 0; i < data.length; i += CHUNK) {
      await chr.writeValueWithoutResponse(data.slice(i, i + CHUNK));
    }
    // No desconectar — mantener conexión viva para la próxima venta
  } catch (e) {
    // Si falla la operación, limpiar caché para forzar re-vinculación
    _deviceCache.forEach((v, k) => { if (v === btRef) _deviceCache.delete(k); });
    try { btRef.gatt.disconnect(); } catch { /* noop */ }
    throw new Error(`Error al escribir en la impresora: ${e.message}`);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   printSaleTicket(saleResponse, extra)
   Punto de entrada principal. Llámalo después de salesService.create().

   @param {object} saleResponse   Respuesta directa de salesService.create()
     .folio           string
     .created_at      string ISO
     .change          number
     .amount_paid     number
     .payment_method  'cash' | 'card'

   @param {object} extra
     .cart[]          items del carrito  { sku, name, quantity, price }
     .total           number
     .cashier         string  nombre del cajero
     .caja            string  nombre de la caja

   @returns {{ ok: boolean, error?: string }}
════════════════════════════════════════════════════════════════════════════ */
export async function printSaleTicket(saleResponse, extra = {}) {
  try {
    const result = await getActivePrinter();
    if (!result) return { ok: false, error: 'No hay impresora con impresión automática habilitada.' };

    const { device, btRef } = result;
    const width = device.config?.ticketWidth ?? '58';

    /* Armar objeto completo para el builder */
    const saleData = {
      folio:          saleResponse.folio          ?? '',
      created_at:     saleResponse.created_at     ?? new Date().toISOString(),
      payment_method: saleResponse.payment_method ?? extra.paymentMethod ?? 'cash',
      amount_paid:    saleResponse.amount_paid    ?? extra.amountPaid    ?? extra.total ?? 0,
      change:         saleResponse.change         ?? 0,
      total:          extra.total                 ?? 0,
      subtotal:       extra.total                 ?? 0,   // sin descuento por ahora
      discount:       0,
      items:          extra.cart                  ?? [],
      cashier:        extra.cashier               ?? '',
      caja:           extra.caja                  ?? '',
    };

    const bytes = buildSaleTicket(saleData, width);

    if (device.connectionType === 'bluetooth') {
      if (!btRef) {
        return {
          ok: false,
          error: 'No se encontró la impresora Bluetooth. Ábrela desde Dispositivos y vincúlala.',
        };
      }
      await sendBytes(btRef, bytes);
      return { ok: true };
    }

    /* Windows: ventana emergente de impresión del sistema */
    if (device.connectionType === 'windows') {
      const win = window.open('', '_blank', `width=${width === '80' ? 380 : 260},height=600`);
      if (!win) return { ok: false, error: 'El navegador bloqueó la ventana emergente.' };

      const rows = (saleData.items || []).map(i => `
        <tr>
          <td>${i.sku ?? ''}</td>
          <td>${i.name ?? ''}</td>
          <td style="text-align:right">${i.quantity}</td>
          <td style="text-align:right">$${Number(i.price).toFixed(2)}</td>
          <td style="text-align:right">$${(i.quantity * i.price).toFixed(2)}</td>
        </tr>`).join('');

      const fecha = new Date(saleData.created_at).toLocaleString('es-MX');

      win.document.write(`<!DOCTYPE html><html><head>
        <style>
          @page { margin:4mm; size:${width}mm auto; }
          body { font-family:monospace; font-size:${width === '80' ? '11' : '9'}px;
                 width:${width}mm; }
          h2 { text-align:center; margin:4px 0; font-size:14px; }
          hr { border:none; border-top:1px dashed #000; margin:3px 0; }
          table { width:100%; border-collapse:collapse; font-size:inherit; }
          th { font-size:9px; text-align:left; border-bottom:1px solid #000; }
          td { padding:1px 0; }
          .right { text-align:right; }
          .bold { font-weight:bold; }
          .row-total { border-top:1px dashed #000; font-weight:bold; }
        </style></head><body>
        <h2>TICKET DE VENTA</h2>
        <hr/>
        <table><tr><td>Folio: <b>${saleData.folio}</b></td><td class="right">${fecha}</td></tr>
          <tr><td colspan="2">Cliente: Publico en general</td></tr>
          <tr><td>Caja: ${saleData.caja}</td><td class="right">Cajero: ${saleData.cashier}</td></tr>
        </table>
        <hr/>
        <table>
          <thead><tr>
            <th>Clave</th><th>Descripcion</th>
            <th class="right">Cant</th><th class="right">P.U.</th><th class="right">Imp.</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <hr/>
        <table>
          <tr><td>Subtotal</td><td class="right">$${saleData.subtotal.toFixed(2)}</td></tr>
          ${saleData.discount > 0 ? `<tr><td>Descuento</td><td class="right">-$${saleData.discount.toFixed(2)}</td></tr>` : ''}
          <tr class="row-total"><td class="bold">TOTAL</td><td class="right bold">$${saleData.total.toFixed(2)}</td></tr>
          <tr><td>${saleData.payment_method === 'card' ? 'Tarjeta' : 'Efectivo'}</td>
              <td class="right">$${saleData.amount_paid.toFixed(2)}</td></tr>
          ${saleData.payment_method !== 'card' ? `<tr><td>Cambio</td><td class="right">$${saleData.change.toFixed(2)}</td></tr>` : ''}
        </table>
        <hr/>
        <p style="text-align:center">Gracias por su compra</p>
        <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>`);
      win.document.close();
      return { ok: true };
    }

    return { ok: false, error: 'Tipo de conexión no reconocido.' };

  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   cacheBtDevice(address, btDevice)
   Guarda en caché la referencia viva de un BluetoothDevice.
   Llámalo desde PrinterSetupModal después de vincular exitosamente.
════════════════════════════════════════════════════════════════════════════ */
export function cacheBtDevice(address, btDevice) {
  if (address && btDevice) _deviceCache.set(address, btDevice);
}