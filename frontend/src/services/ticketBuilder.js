/* ═══════════════════════════════════════════════════════════════════════════
   ticketBuilder.js
   Construye el Uint8Array ESC/POS para el ticket de venta.

   Columnas disponibles por ancho:
     58 mm → ~32 caracteres  (impresora de bolsillo estándar)
     80 mm → ~48 caracteres  (impresora de escritorio estándar)
═══════════════════════════════════════════════════════════════════════════ */

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

/* ── Codificación Latin-1 ─────────────────────────────────────────────── */
function enc(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    bytes.push(c <= 0xFF ? c : 0x3F);
  }
  return bytes;
}

/* ── Helpers de formato ───────────────────────────────────────────────── */

/** Rellena o recorta un string a exactamente `len` caracteres */
function pad(str, len, align = 'left', fill = ' ') {
  const s = String(str ?? '');
  if (s.length >= len) return align === 'right' ? s.slice(-len) : s.slice(0, len);
  const padding = fill.repeat(len - s.length);
  return align === 'right' ? padding + s : s + padding;
}

/** Línea de separador */
function sep(cols) {
  return [...enc('-'.repeat(cols)), LF];
}

/** Línea en blanco */
const BLANK = [LF];

/** Línea centrada */
function centered(text, cols) {
  const spaces = Math.max(0, Math.floor((cols - text.length) / 2));
  return [...enc(' '.repeat(spaces) + text), LF];
}

/** Dos columnas: izquierda y derecha */
function twoCol(left, right, cols) {
  const maxLeft = cols - right.length - 1;
  const l = pad(left, maxLeft, 'left').slice(0, maxLeft);
  return [...enc(l + ' ' + right), LF];
}

/**
 * Línea de producto — adapta columnas según ancho del papel.
 *
 * 58 mm (32 cols):
 *   Línea 1:  <clave truncada>
 *   Línea 2:  <nombre truncado>
 *   Línea 3:  <qty> x $<precio unit>         $<importe>
 *
 * 80 mm (48 cols):
 *   Línea 1:  <clave>  <nombre truncado>
 *   Línea 2:  <qty> x $<precio unit>         $<importe>
 */
function productLines(item, cols) {
  const clave    = item.sku || '---';
  const nombre   = item.name || '';
  const qty      = item.quantity;
  const precio   = Number(item.price).toFixed(2);
  const importe  = (item.quantity * item.price).toFixed(2);
  const lines    = [];

  if (cols >= 48) {
    // 80 mm: clave + nombre en una línea
    const claveCol = 10;
    const nameCol  = cols - claveCol - 1;
    lines.push(...enc(pad(clave, claveCol) + ' ' + pad(nombre, nameCol)), LF);
  } else {
    // 58 mm: clave en su propia línea, nombre en la siguiente
    lines.push(...enc(pad(clave, cols)), LF);
    lines.push(...enc(pad(nombre, cols)), LF);
  }

  // Fila de cantidades
  const qtyStr     = `${qty} x $${precio}`;
  const importeStr = `$${importe}`;
  lines.push(...twoCol(qtyStr, importeStr, cols));

  return lines;
}

/* ══════════════════════════════════════════════════════════════════════════
   buildSaleTicket
   @param {object} sale        Objeto de la venta
     sale.folio                string
     sale.created_at           string ISO (o Date)
     sale.payment_method       'cash' | 'card'
     sale.amount_paid          number
     sale.change               number
     sale.items[]              { sku, name, quantity, price }
     sale.subtotal             number  (opcional, se calcula si no viene)
     sale.total                number
     sale.discount             number  (0 si no aplica)
     sale.cashier              string  (nombre del usuario)
     sale.caja                 string  (nombre de la caja)
   @param {'58'|'80'} width    Ancho del papel
   @returns {Uint8Array}
════════════════════════════════════════════════════════════════════════════ */
export function buildSaleTicket(sale, width = '58') {
  const cols = width === '80' ? 48 : 32;

  const fecha = (() => {
    try {
      const d = sale.created_at ? new Date(sale.created_at) : new Date();
      return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return ''; }
  })();

  const hora = (() => {
    try {
      const d = sale.created_at ? new Date(sale.created_at) : new Date();
      return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return ''; }
  })();

  const subtotal = sale.subtotal
    ?? (sale.items || []).reduce((s, i) => s + i.quantity * i.price, 0);
  const discount = Number(sale.discount ?? 0);
  const total    = Number(sale.total ?? subtotal - discount);
  const paid     = Number(sale.amount_paid ?? total);
  const change   = Number(sale.change ?? Math.max(0, paid - total));

  const metodoPago = sale.payment_method === 'card' ? 'Tarjeta' : 'Efectivo';

  const cmd = [
    /* ── Init ── */
    ESC, 0x40,           // Inicializar
    ESC, 0x74, 0x01,     // Latin-1

    /* ── Encabezado ── */
    ESC, 0x61, 0x01,     // centrar
    GS, 0x21, 0x11,      // doble ancho + alto
    ...enc('TICKET DE VENTA'), LF,
    GS, 0x21, 0x00,      // tamaño normal
    ...BLANK,

    /* ── Folio, fecha, hora ── */
    ESC, 0x61, 0x00,     // izquierda
    ...twoCol(`Folio: ${sale.folio ?? ''}`, fecha, cols),
    ...twoCol('Cliente: Publico en general', hora, cols),
    ...twoCol(`Caja: ${sale.caja ?? ''}`, '', cols),
    ...twoCol(`Cajero: ${sale.cashier ?? ''}`, '', cols),

    /* ── Productos ── */
    ...sep(cols),

    // Encabezado de columnas
    ...(cols >= 48
      ? [...enc(pad('CLAVE', 10) + ' ' + pad('DESCRIPCION', cols - 10 - 1)), LF]
      : [...enc(pad('CLAVE / DESCRIPCION', cols)), LF]
    ),
    ...twoCol('CANT x P.U.', 'IMPORTE', cols),
    ...sep(cols),

    // Productos
    ...(sale.items || []).flatMap(item => [
      ...productLines(item, cols),
    ]),

    /* ── Totales ── */
    ...sep(cols),
    ...twoCol('Subtotal:', `$${Number(subtotal).toFixed(2)}`, cols),

    ...(discount > 0
      ? twoCol('Descuento:', `-$${discount.toFixed(2)}`, cols)
      : []
    ),

    ESC, 0x45, 0x01,     // negrita ON
    ...twoCol('TOTAL:', `$${total.toFixed(2)}`, cols),
    ESC, 0x45, 0x00,     // negrita OFF

    ...sep(cols),

    ...twoCol(`${metodoPago}:`, `$${paid.toFixed(2)}`, cols),

    ...(sale.payment_method !== 'card'
      ? twoCol('Cambio:', `$${change.toFixed(2)}`, cols)
      : []
    ),

    /* ── Pie ── */
    ...BLANK,
    ...centered('Gracias por su compra', cols),
    ...BLANK,

    /* ── Corte ── */
    LF, LF, LF,
    GS, 0x56, 0x01,      // corte parcial
  ];

  return new Uint8Array(cmd);
}

/* ══════════════════════════════════════════════════════════════════════════
   buildTestTicket  (re-exportado para que PrinterSetupModal lo importe aquí)
════════════════════════════════════════════════════════════════════════════ */
export function buildTestTicket(deviceName, width = '58') {
  const cols = width === '80' ? 48 : 32;

  const cmd = [
    ESC, 0x40,
    ESC, 0x74, 0x01,
    ESC, 0x61, 0x01,
    GS, 0x21, 0x11,
    ...enc('Hola Mundo'), LF,
    GS, 0x21, 0x00,
    ...sep(cols),
    ESC, 0x61, 0x00,
    ...twoCol('Dispositivo:', deviceName, cols),
    ...twoCol('Ancho papel:', `${width} mm`, cols),
    ...enc('Prueba de impresion ESC/POS'), LF,
    LF, LF, LF,
    GS, 0x56, 0x01,
  ];

  return new Uint8Array(cmd);
}