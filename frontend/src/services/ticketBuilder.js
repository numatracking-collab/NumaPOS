/* ═══════════════════════════════════════════════════════════════════════════
   ticketBuilder.js
   Construye el Uint8Array ESC/POS para el ticket de venta.

   Columnas disponibles por ancho:
     58 mm → ~32 caracteres
     80 mm → ~48 caracteres

   Campos en sale.items:
     item.discount_amount   number  — descuento total de esa línea (0 si sin oferta)
     item.offer_label       string  — etiqueta legible, ej. "PROMO PAPITAS 4 X 3"

   Formato de línea con promoción:
     58 mm:
       <clave>
       <nombre>
       4 x $20.00                  $80.00     ← precio catálogo × qty
       PROMO PAPITAS 4 X 3        -$20.00     ← en NEGRITA

     80 mm:
       <clave>  <nombre truncado>
       4 x $20.00                  $80.00
       PROMO PAPITAS 4 X 3        -$20.00     ← en NEGRITA
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
function pad(str, len, align = 'left', fill = ' ') {
    const s = String(str ?? '');
    if (s.length >= len) return align === 'right' ? s.slice(-len) : s.slice(0, len);
    const padding = fill.repeat(len - s.length);
    return align === 'right' ? padding + s : s + padding;
}

function sep(cols)            { return [...enc('-'.repeat(cols)), LF]; }
const BLANK                   = [LF];
function centered(text, cols) {
    const spaces = Math.max(0, Math.floor((cols - text.length) / 2));
    return [...enc(' '.repeat(spaces) + text), LF];
}
function twoCol(left, right, cols) {
    const maxLeft = cols - right.length - 1;
    const l = pad(left, maxLeft, 'left').slice(0, maxLeft);
    return [...enc(l + ' ' + right), LF];
}

/**
 * Línea(s) de producto.
 *
 * Si item.discount_amount > 0 imprime debajo la etiqueta de promoción
 * en NEGRITA con el descuento aplicado:
 *
 *   4 x $20.00                  $80.00
 *   PROMO PAPITAS 4 X 3        -$20.00   ← negrita
 */
function productLines(item, cols) {
    const clave        = item.sku  || '---';
    const nombre       = item.name || '';
    const qty          = item.quantity;
    const precio       = Number(item.price).toFixed(2);
    // Importe sin descuento (precio catálogo × cantidad)
    const importeBruto = (qty * Number(item.price)).toFixed(2);
    const discount     = Number(item.discount_amount ?? 0);
    const lines        = [];

    /* Encabezado de producto */
    if (cols >= 48) {
        const claveCol = 10;
        const nameCol  = cols - claveCol - 1;
        lines.push(...enc(pad(clave, claveCol) + ' ' + pad(nombre, nameCol)), LF);
    } else {
        lines.push(...enc(pad(clave, cols)), LF);
        lines.push(...enc(pad(nombre, cols)), LF);
    }

    /* Fila cantidad × precio  →  importe bruto */
    lines.push(...twoCol(`${qty} x $${precio}`, `$${importeBruto}`, cols));

    /* ── Línea de PROMOCIÓN ──────────────────────────────────────────────
       Se muestra en negrita y sin sangría para que destaque visualmente.
       Ejemplo:
         PROMO PAPITAS 4 X 3      -$20.00
    ─────────────────────────────────────────────────────────────────── */
    if (discount > 0) {
        const label = (item.offer_label || 'PROMO').toUpperCase();
        lines.push(
            ESC, 0x45, 0x01,                                       // negrita ON
            ...twoCol(label, `-$${discount.toFixed(2)}`, cols),
            ESC, 0x45, 0x00,                                       // negrita OFF
        );
    }

    return lines;
}

/* ══════════════════════════════════════════════════════════════════════════
   buildSaleTicket
   @param {object} sale
     sale.folio              string
     sale.created_at         string ISO
     sale.payment_method     'cash' | 'card'
     sale.amount_paid        number
     sale.change             number
     sale.items[]            { sku, name, quantity, price, subtotal,
                               discount_amount?, offer_label? }
     sale.subtotal           number  — precio bruto (antes de descuentos)
     sale.discount           number  — descuento total
     sale.total              number  — lo que realmente se cobró
     sale.customer_name      string  — nombre del cliente (opcional)
     sale.cashier            string
     sale.caja               string  — opcional, no se imprime si está vacío
   @param {'58'|'80'} width
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

    /* ── Cálculo de totales ──────────────────────────────────────────── */
    const rawSubtotal = (sale.items || []).reduce(
        (s, i) => s + Number(i.quantity) * Number(i.price), 0
    );
    const subtotal = Number(sale.subtotal ?? rawSubtotal);
    const discount = Number(
        sale.discount ??
        (sale.items || []).reduce((s, i) => s + Number(i.discount_amount ?? 0), 0)
    );
    const total  = Number(sale.total ?? (subtotal - discount));
    const paid   = Number(sale.amount_paid ?? total);
    const change = Number(sale.change ?? Math.max(0, paid - total));

    const metodoPago  = sale.payment_method === 'card' ? 'Tarjeta' : 'Efectivo';
    const hayPromo    = discount > 0;

    const cmd = [
        /* Init */
        ESC, 0x40,
        ESC, 0x74, 0x01,

        /* Encabezado */
        ESC, 0x61, 0x01,
        GS,  0x21, 0x11,
        ...enc('TICKET DE VENTA'), LF,
        GS,  0x21, 0x00,
        ...BLANK,

        /* Folio, fecha, hora */
        ESC, 0x61, 0x00,
        ...twoCol(`Folio: ${sale.folio ?? ''}`, fecha, cols),
        // Nombre del cliente (fallback: "Publico en general")
        ...twoCol(`Cliente: ${sale.customer_name || 'Publico en general'}`, hora, cols),
        // Caja solo se imprime si tiene valor
        ...(sale.caja ? twoCol(`Caja: ${sale.caja}`, '', cols) : []),
        ...twoCol(`Cajero: ${sale.cashier ?? ''}`, '', cols),

        /* Productos */
        ...sep(cols),
        ...(cols >= 48
            ? [...enc(pad('CLAVE', 10) + ' ' + pad('DESCRIPCION', cols - 10 - 1)), LF]
            : [...enc(pad('CLAVE / DESCRIPCION', cols)), LF]
        ),
        ...twoCol('CANT x P.U.', 'IMPORTE', cols),
        ...sep(cols),

        ...(sale.items || []).flatMap(item => productLines(item, cols)),

        /* ── Totales ─────────────────────────────────────────────────────
           Subtotal  (precio bruto)          siempre
           Descuentos  -$XX.XX              solo si hay promo
           ─────────────
           TOTAL                             siempre (en negrita)
        ──────────────────────────────────────────────────────────────── */
        ...sep(cols),

        ...twoCol('Subtotal:', `$${subtotal.toFixed(2)}`, cols),

        // Descuento total — solo visible cuando hay al menos una promoción
        ...(hayPromo
            ? twoCol('Descuentos:', `-$${discount.toFixed(2)}`, cols)
            : []
        ),

        // Separador fino antes del total cuando hay descuento
        ...(hayPromo ? sep(cols) : []),

        ESC, 0x45, 0x01,
        ...twoCol('TOTAL:', `$${total.toFixed(2)}`, cols),
        ESC, 0x45, 0x00,

        ...sep(cols),
        ...twoCol(`${metodoPago}:`, `$${paid.toFixed(2)}`, cols),

        ...(sale.payment_method !== 'card'
            ? twoCol('Cambio:', `$${change.toFixed(2)}`, cols)
            : []
        ),

        /* Pie */
        ...BLANK,
        ...centered('Gracias por su compra', cols),
        ...BLANK,

        /* Corte */
        LF, LF, LF,
        GS, 0x56, 0x01,
    ];

    return new Uint8Array(cmd);
}

/* ══════════════════════════════════════════════════════════════════════════
   buildTestTicket
════════════════════════════════════════════════════════════════════════════ */
export function buildTestTicket(deviceName, width = '58') {
    const cols = width === '80' ? 48 : 32;
    const cmd  = [
        ESC, 0x40,
        ESC, 0x74, 0x01,
        ESC, 0x61, 0x01,
        GS,  0x21, 0x11,
        ...enc('Hola Mundo'), LF,
        GS,  0x21, 0x00,
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