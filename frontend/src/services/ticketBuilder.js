/* ═══════════════════════════════════════════════════════════════════════════
   ticketBuilder.js
   Construye el Uint8Array ESC/POS para el ticket de venta.

   Columnas disponibles por ancho:
     58 mm → ~32 caracteres
     80 mm → ~48 caracteres

   Campos en sale.items:
     item.discount_amount   number  — descuento total de esa línea (0 si sin oferta)
     item.offer_label       string  — etiqueta legible, ej. "PROMO PAPITAS 4 X 3"

   FASE 4 — Encabezado de negocio + formato configurable:
     business:      { business_name, phone, email, address, logoRaster }
                     logoRaster es un Uint8Array ya listo con el comando
                     GS v 0 (ver services/logoRaster.js) — este archivo NO
                     convierte imágenes, solo lo inserta si viene presente.
     ticketConfig:  { show_logo, show_business_name, show_phone, show_email,
                       show_address, show_sku, show_discounts, show_cashier,
                       show_caja }
═══════════════════════════════════════════════════════════════════════════ */

const ESC = 0x1B;
const GS  = 0x1D;
const LF  = 0x0A;

const DEFAULT_TICKET_CONFIG = {
    show_logo: true,
    show_business_name: true,
    show_phone: true,
    show_email: false,
    show_address: true,
    show_sku: true,
    show_discounts: true,
    show_cashier: true,
    show_caja: true,
};

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

/* ── Encabezado de negocio (logo + datos de contacto) ───────────────────
   Se arma por separado porque debe ir ANTES de "TICKET DE VENTA" y
   respeta cada toggle de forma independiente. ─────────────────────────── */
function buildBusinessHeader(business, cfg, cols) {
    const lines = [];

    if (cfg.show_logo && business.logoRaster instanceof Uint8Array) {
        lines.push(...business.logoRaster, LF);
    }

    if (cfg.show_business_name && business.business_name) {
        lines.push(
            GS, 0x21, 0x01,                       // texto doble alto
            ...centered(business.business_name, cols),
            GS, 0x21, 0x00,
        );
    }

    if (cfg.show_phone && business.phone) {
        lines.push(...centered(business.phone, cols));
    }
    if (cfg.show_email && business.email) {
        lines.push(...centered(business.email, cols));
    }
    if (cfg.show_address && business.address) {
        lines.push(...centered(business.address, cols));
    }

    if (lines.length) lines.push(...sep(cols));
    return lines;
}

function productLines(item, cols, cfg) {
    const clave        = item.sku  || '---';
    const nombre       = item.name || '';
    const qty          = item.quantity;
    const precio       = Number(item.price).toFixed(2);
    const importeBruto = (qty * Number(item.price)).toFixed(2);
    const discount     = Number(item.discount_amount ?? 0);
    const lines        = [];

    const showSku = cfg.show_sku !== false;

    if (cols >= 48) {
        if (showSku) {
            const claveCol = 10;
            const nameCol  = cols - claveCol - 1;
            lines.push(...enc(pad(clave, claveCol) + ' ' + pad(nombre, nameCol)), LF);
        } else {
            lines.push(...enc(pad(nombre, cols)), LF);
        }
    } else {
        if (showSku) lines.push(...enc(pad(clave, cols)), LF);
        lines.push(...enc(pad(nombre, cols)), LF);
    }

    lines.push(...twoCol(`${qty} x $${precio}`, `$${importeBruto}`, cols));

    if (discount > 0 && cfg.show_discounts !== false) {
        const label = (item.offer_label || 'PROMO').toUpperCase();
        lines.push(
            ESC, 0x45, 0x01,
            ...twoCol(label, `-$${discount.toFixed(2)}`, cols),
            ESC, 0x45, 0x00,
        );
    }

    return lines;
}

/* ══════════════════════════════════════════════════════════════════════════
   buildSaleTicket
   @param {object} sale
   @param {string} width          '58' | '80'
   @param {object} business       datos del negocio (ver encabezado del archivo)
   @param {object} ticketConfig   toggles de formato (ver DEFAULT_TICKET_CONFIG)
════════════════════════════════════════════════════════════════════════════ */
export function buildSaleTicket(sale, width = '58', business = {}, ticketConfig = {}) {
    const cols = width === '80' ? 48 : 32;
    const cfg  = { ...DEFAULT_TICKET_CONFIG, ...ticketConfig };

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
    const hayPromo    = discount > 0 && cfg.show_discounts !== false;

    const businessHeader = buildBusinessHeader(business, cfg, cols);

    const infoLines = [
        ...twoCol(`Folio: ${sale.folio ?? ''}`, fecha, cols),
        ...twoCol(`Cliente: ${sale.customer_name || 'Publico en general'}`, hora, cols),
        ...(cfg.show_caja && sale.caja ? twoCol(`Caja: ${sale.caja}`, '', cols) : []),
        ...(cfg.show_cashier ? twoCol(`Cajero: ${sale.cashier ?? ''}`, '', cols) : []),
    ];

    const cmd = [
        ESC, 0x40,
        ESC, 0x74, 0x01,
        ESC, 0x61, 0x01,
        ...businessHeader,
        GS,  0x21, 0x11,
        ...enc('TICKET DE VENTA'), LF,
        GS,  0x21, 0x00,
        ...BLANK,
        ESC, 0x61, 0x00,
        ...infoLines,
        ...sep(cols),
        ...(cols >= 48
            ? [...enc(pad(cfg.show_sku !== false ? 'CLAVE' : '', 10) + ' ' + pad('DESCRIPCION', cols - 10 - 1)), LF]
            : [...enc(pad(cfg.show_sku !== false ? 'CLAVE / DESCRIPCION' : 'DESCRIPCION', cols)), LF]
        ),
        ...twoCol('CANT x P.U.', 'IMPORTE', cols),
        ...sep(cols),
        ...(sale.items || []).flatMap(item => productLines(item, cols, cfg)),
        ...sep(cols),
        ...twoCol('Subtotal:', `$${subtotal.toFixed(2)}`, cols),
        ...(hayPromo ? twoCol('Descuentos:', `-$${discount.toFixed(2)}`, cols) : []),
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
        ...BLANK,
        ...centered('Gracias por su compra', cols),
        ...BLANK,
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

/* ══════════════════════════════════════════════════════════════════════════
   openCashDrawer
   ───────────────────────────────────────────────────────────────────────────
   Genera el pulso ESC/POS estándar para abrir el cajón de dinero.

   Comando: ESC p <pin> <on-time> <off-time>
     ESC p = 0x1B 0x70
     pin   = 0x00 (pin 2) — el más común en impresoras térmicas.
             Si no funciona, probar 0x01 (pin 5).
     on-time  = 0x19 (25 × 2ms = 50ms de pulso)
     off-time = 0xFA (250 × 2ms = 500ms de pausa)

   Este comando es compatible con la mayoría de impresoras térmicas ESC/POS:
   Epson TM, Bixolon SRP, POS-5890Z, y clones chinos.

   Se llama por separado del ticket — no necesita inicializar la impresora
   (ESC @) porque puede enviarse solo, antes o después del ticket.
   ══════════════════════════════════════════════════════════════════════════ */
export function buildDrawerPulse() {
    return new Uint8Array([
        ESC, 0x70, 0x00, 0x19, 0xFA,   // pin 2 (más común)
        ESC, 0x70, 0x01, 0x19, 0xFA,   // pin 5 (fallback por si acaso)
    ]);
}