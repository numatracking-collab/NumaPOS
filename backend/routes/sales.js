import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sales  — Registrar venta
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id, userId: user_id } = req.user;

        const {
            payment_method = 'cash',
            amount_paid    = 0,
            caja_id        = null,
            items          = [],
        } = req.body;

        if (!caja_id)
            return res.status(400).json({ error: 'Debes seleccionar una caja para registrar la venta.' });
        if (!Array.isArray(items) || items.length === 0)
            return res.status(400).json({ error: 'Debes enviar al menos un producto.' });

        await client.query('BEGIN');

        // ── 1. Serie por defecto ──────────────────────────────────────────────
        const seriesResult = await client.query(
            `SELECT * FROM invoice_series
             WHERE tenant_id = $1 AND is_default = true
             LIMIT 1 FOR UPDATE`,
            [tenant_id]
        );

        let series;
        if (seriesResult.rowCount === 0) {
            const ns = await client.query(
                `INSERT INTO invoice_series (tenant_id, name, prefix, next_folio, is_default)
                 VALUES ($1, 'Principal', 'A', 1, true) RETURNING *`,
                [tenant_id]
            );
            series = ns.rows[0];
        } else {
            series = seriesResult.rows[0];
        }

        const folioNumber = series.next_folio;

        // ── 2. Validar stock y armar items ────────────────────────────────────
        let total_amount = 0;
        const normalizedItems = [];

        for (const item of items) {
            const productId = Number(item.product_id);
            const quantity  = Number(item.quantity);

            if (!Number.isInteger(productId) || productId <= 0)
                throw new Error('product_id inválido en uno de los items.');
            if (!Number.isInteger(quantity) || quantity <= 0)
                throw new Error(`Cantidad inválida para el producto ${productId}.`);

            const pr = await client.query(
                `SELECT id, name, stock, price FROM products
                 WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
                [productId, tenant_id]
            );

            if (pr.rowCount === 0)
                return res.status(404).json({ error: `Producto ID ${productId} no encontrado.` });

            const product = pr.rows[0];

            if (Number(product.stock) < quantity)
                return res.status(400).json({
                    error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${quantity}.`
                });

            const unitPrice = Number(product.price);
            const subtotal  = Number((unitPrice * quantity).toFixed(2));
            total_amount   += subtotal;

            normalizedItems.push({ product_id: product.id, quantity, unit_price: unitPrice, subtotal });
        }

        total_amount = Number(total_amount.toFixed(2));
        const paidAmount = Number(amount_paid || 0);

        if (payment_method === 'cash' && paidAmount < total_amount)
            return res.status(400).json({ error: 'El monto pagado en efectivo es menor al total.' });

        // ── 3. Insertar venta ─────────────────────────────────────────────────
        const saleResult = await client.query(
            `INSERT INTO sales
                (tenant_id, user_id, caja_id, series_id, folio_number,
                 total_amount, tax_amount, payment_method, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')
             RETURNING *`,
            [tenant_id, user_id, caja_id, series.id, folioNumber,
             total_amount, 0.00, payment_method]
        );
        const sale = saleResult.rows[0];

        // ── 4. Avanzar folio ──────────────────────────────────────────────────
        await client.query(
            `UPDATE invoice_series SET next_folio = next_folio + 1 WHERE id = $1`,
            [series.id]
        );

        // ── 5. sale_items + descontar stock ───────────────────────────────────
        for (const item of normalizedItems) {
            await client.query(
                `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, subtotal)
                 VALUES ($1, $2, $3, $4, $5)`,
                [sale.id, item.product_id, item.quantity, item.unit_price, item.subtotal]
            );
            await client.query(
                `UPDATE products SET stock = stock - $1 WHERE id = $2`,
                [item.quantity, item.product_id]
            );
        }

        await client.query('COMMIT');

        const folio = `${series.prefix}${String(folioNumber).padStart(4, '0')}`;

        return res.status(201).json({
            message:     'Venta registrada correctamente.',
            folio,
            sale:        { ...sale, total_amount: Number(sale.total_amount), tax_amount: Number(sale.tax_amount) },
            items:       normalizedItems,
            amount_paid: paidAmount,
            change:      payment_method === 'cash'
                ? Number((paidAmount - total_amount).toFixed(2))
                : 0,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creando venta:', error);
        return res.status(500).json({ error: error.message || 'Error al registrar la venta.' });
    } finally {
        client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales — Listar ventas con soporte para filtros por fecha
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const page   = Math.max(Number(req.query.page)  || 1,  1);
        const limit  = Math.max(Number(req.query.limit) || 20, 1);
        const offset = (page - 1) * limit;
        const from   = req.query.from || null;
        const to     = req.query.to   || null;

        const params  = [tenant_id];
        let whereExtra = '';

        if (from) {
            params.push(from);
            whereExtra += ` AND s.created_at >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            whereExtra += ` AND s.created_at <= $${params.length}`;
        }

        const dataParams  = [...params, limit, offset];
        const countParams = [...params];

        const result = await pool.query(
            `SELECT s.*,
                    CONCAT(COALESCE(i.prefix,''), LPAD(s.folio_number::text, 4, '0')) AS folio,
                    c.name AS caja_name
             FROM sales s
             LEFT JOIN invoice_series i ON i.id = s.series_id
             LEFT JOIN cajas c          ON c.id = s.caja_id
             WHERE s.tenant_id = $1${whereExtra}
             ORDER BY s.created_at DESC, s.id DESC
             LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );

        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM sales s WHERE s.tenant_id = $1${whereExtra}`,
            countParams
        );

        return res.json({
            data: result.rows,
            pagination: {
                page, limit,
                total: count.rows[0].total,
                pages: Math.ceil(count.rows[0].total / limit)
            }
        });
    } catch (error) {
        console.error('Error listando ventas:', error);
        return res.status(500).json({ error: 'Error al obtener las ventas.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sales/:id — Detalle de una venta (incluye imagen del producto)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { id } = req.params;

        const saleResult = await pool.query(
            `SELECT s.*,
                    CONCAT(COALESCE(i.prefix,''), LPAD(s.folio_number::text, 4, '0')) AS folio,
                    c.name AS caja_name
             FROM sales s
             LEFT JOIN invoice_series i ON i.id = s.series_id
             LEFT JOIN cajas c          ON c.id = s.caja_id
             WHERE s.id = $1 AND s.tenant_id = $2`,
            [id, tenant_id]
        );

        if (saleResult.rowCount === 0)
            return res.status(404).json({ error: 'La venta solicitada no existe.' });

        // ── Incluir image_url del producto ────────────────────────────────────
        const itemsResult = await pool.query(
            `SELECT si.*, p.name AS product_name, p.sku, p.image_url
             FROM sale_items si
             JOIN products p ON p.id = si.product_id
             WHERE si.sale_id = $1
             ORDER BY si.id ASC`,
            [id]
        );

        return res.json({
            ...saleResult.rows[0],
            items: itemsResult.rows
        });

    } catch (error) {
        console.error('Error obteniendo detalle de venta:', error);
        return res.status(500).json({ error: 'Error al obtener el detalle de la venta.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/sales/:id/cancel — Cancelar una venta
//
// • Marca la venta con status = 'cancelled' y guarda la razón + quién canceló
// • Devuelve el stock de cada artículo al inventario
// • NO elimina ningún registro (trazabilidad completa)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/cancel', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id, userId: user_id } = req.user;
        const { id } = req.params;
        const { reason = '' } = req.body;

        await client.query('BEGIN');

        // ── 1. Obtener la venta (con bloqueo para evitar doble cancelación) ──
        const saleResult = await client.query(
            `SELECT * FROM sales
             WHERE id = $1 AND tenant_id = $2
             FOR UPDATE`,
            [id, tenant_id]
        );

        if (saleResult.rowCount === 0)
            return res.status(404).json({ error: 'La venta no existe.' });

        const sale = saleResult.rows[0];

        if (sale.status === 'cancelled')
            return res.status(400).json({ error: 'Esta venta ya estaba cancelada.' });

        // ── 2. Marcar como cancelada ──────────────────────────────────────────
        await client.query(
            `UPDATE sales
             SET status           = 'cancelled',
                 cancelled_at     = NOW(),
                 cancelled_by     = $1,
                 cancellation_reason = $2
             WHERE id = $3`,
            [user_id, reason.trim(), id]
        );

        // ── 3. Obtener los artículos de la venta ──────────────────────────────
        const itemsResult = await client.query(
            `SELECT * FROM sale_items WHERE sale_id = $1`,
            [id]
        );

        // ── 4. Regresar stock producto por producto ───────────────────────────
        for (const item of itemsResult.rows) {
            await client.query(
                `UPDATE products SET stock = stock + $1 WHERE id = $2 AND tenant_id = $3`,
                [item.quantity, item.product_id, tenant_id]
            );
        }

        await client.query('COMMIT');

        return res.json({
            message: 'Venta cancelada correctamente. El inventario ha sido restituido.',
            sale_id: Number(id),
            items_restored: itemsResult.rowCount,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error cancelando venta:', error);
        return res.status(500).json({ error: 'Error al cancelar la venta.' });
    } finally {
        client.release();
    }
});

export default router;