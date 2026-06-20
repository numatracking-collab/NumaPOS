import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

/* ═══════════════════════════════════════════════════════════════════════════
   CAJAS
═══════════════════════════════════════════════════════════════════════════ */

// GET /api/cash-registers/cajas
router.get('/cajas', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const result = await pool.query(
            `SELECT * FROM cajas WHERE tenant_id = $1 AND is_active = true ORDER BY name ASC`,
            [tenant_id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Error listando cajas:', error);
        return res.status(500).json({ error: 'Error al obtener las cajas.' });
    }
});

// POST /api/cash-registers/cajas
router.post('/cajas', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { name } = req.body;
        if (!name?.trim())
            return res.status(400).json({ error: 'El nombre de la caja es requerido.' });
        const result = await pool.query(
            `INSERT INTO cajas (tenant_id, name) VALUES ($1, $2) RETURNING *`,
            [tenant_id, name.trim()]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creando caja:', error);
        return res.status(500).json({ error: 'Error al crear la caja.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   MOVIMIENTOS DE CAJA
═══════════════════════════════════════════════════════════════════════════ */

// GET /api/cash-registers/movements?caja_id=X
router.get('/movements', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { caja_id } = req.query;

        let q = `
            SELECT cm.*, c.name AS caja_name
            FROM cash_movements cm
            LEFT JOIN cajas c ON c.id = cm.caja_id
            WHERE cm.tenant_id = $1
        `;
        const params = [tenant_id];

        if (caja_id) {
            params.push(caja_id);
            q += ` AND cm.caja_id = $${params.length}`;
        }
        q += ` ORDER BY cm.created_at DESC LIMIT 200`;

        const result = await pool.query(q, params);
        return res.json(result.rows);
    } catch (error) {
        console.error('Error listando movimientos:', error);
        return res.status(500).json({ error: 'Error al obtener los movimientos.' });
    }
});

// POST /api/cash-registers/movements
router.post('/movements', async (req, res) => {
    try {
        const { tenantId: tenant_id, userId: user_id } = req.user;
        const { caja_id, type, amount, reason = '' } = req.body;

        if (!caja_id)
            return res.status(400).json({ error: 'Debes indicar la caja.' });
        if (!['in', 'out'].includes(type))
            return res.status(400).json({ error: 'Tipo inválido. Usa "in" o "out".' });

        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0)
            return res.status(400).json({ error: 'El monto debe ser mayor a 0.' });
        if (!reason.trim())
            return res.status(400).json({ error: 'El motivo es requerido.' });

        // Verificar que la caja pertenece al tenant
        const cajaCheck = await pool.query(
            `SELECT id FROM cajas WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
            [caja_id, tenant_id]
        );
        if (cajaCheck.rowCount === 0)
            return res.status(404).json({ error: 'Caja no encontrada.' });

        const result = await pool.query(
            `INSERT INTO cash_movements (tenant_id, caja_id, user_id, type, amount, reason)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [tenant_id, caja_id, user_id, type, amt, reason.trim()]
        );

        return res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creando movimiento:', error);
        return res.status(500).json({ error: 'Error al registrar el movimiento.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   PREVIEW DEL CORTE
   Devuelve totales del sistema para que el cajero los compare con su conteo.
   Incluye: saldo anterior, ventas por método, movimientos y efectivo esperado.
═══════════════════════════════════════════════════════════════════════════ */

// GET /api/cash-registers/preview?caja_id=X
router.get('/preview', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { caja_id } = req.query;

        if (!caja_id)
            return res.status(400).json({ error: 'caja_id es requerido.' });

        // ── Último corte → fecha de inicio del período y saldo dejado ─────────
        const lastCut = await pool.query(
            `SELECT created_at, leave_balance FROM cash_registers
             WHERE caja_id = $1 AND tenant_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [caja_id, tenant_id]
        );
        const since        = lastCut.rowCount > 0 ? lastCut.rows[0].created_at : new Date(0);
        const prev_balance = lastCut.rowCount > 0 ? Number(lastCut.rows[0].leave_balance ?? 0) : 0;

        // ── Ventas por método de pago (solo completadas) ──────────────────────
        const salesResult = await pool.query(
            `SELECT
                payment_method,
                COUNT(*)::int                   AS sale_count,
                COALESCE(SUM(total_amount), 0)  AS subtotal
             FROM sales
             WHERE caja_id = $1 AND tenant_id = $2
               AND created_at > $3 AND status = 'completed'
             GROUP BY payment_method`,
            [caja_id, tenant_id, since]
        );

        let sales_cash = 0, sales_card = 0, sales_count = 0;
        for (const row of salesResult.rows) {
            if (row.payment_method === 'cash') sales_cash = Number(row.subtotal);
            if (row.payment_method === 'card') sales_card = Number(row.subtotal);
            sales_count += row.sale_count;
        }

        // ── Movimientos desde el último corte ─────────────────────────────────
        const movResult = await pool.query(
            `SELECT type, COALESCE(SUM(amount), 0) AS total
             FROM cash_movements
             WHERE caja_id = $1 AND tenant_id = $2 AND created_at > $3
             GROUP BY type`,
            [caja_id, tenant_id, since]
        );

        let movements_in = 0, movements_out = 0;
        for (const row of movResult.rows) {
            if (row.type === 'in')  movements_in  = Number(row.total);
            if (row.type === 'out') movements_out = Number(row.total);
        }

        // Efectivo esperado = saldo anterior + ventas efectivo + entradas – salidas
        const expected_cash = prev_balance + sales_cash + movements_in - movements_out;

        return res.json({
            since,
            sales_count,
            prev_balance:  Number(prev_balance.toFixed(2)),
            sales_cash:    Number(sales_cash.toFixed(2)),
            sales_card:    Number(sales_card.toFixed(2)),
            movements_in:  Number(movements_in.toFixed(2)),
            movements_out: Number(movements_out.toFixed(2)),
            expected_cash: Number(expected_cash.toFixed(2)),
            expected_card: Number(sales_card.toFixed(2)),
        });
    } catch (error) {
        console.error('Error en preview:', error);
        return res.status(500).json({ error: 'Error al obtener el preview.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   REALIZAR CORTE
   Recibe los conteos del cajero, calcula diferencias y guarda el registro.
   No devuelve el resultado detallado; el cajero lo consulta en Historial.
═══════════════════════════════════════════════════════════════════════════ */

// POST /api/cash-registers/corte
router.post('/corte', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id, userId: user_id } = req.user;
        const {
            caja_id,
            notes         = '',
            counted_cash  = 0,
            counted_card  = 0,
            leave_balance = 0,
        } = req.body;

        if (!caja_id)
            return res.status(400).json({ error: 'Debes indicar el caja_id para el corte.' });

        await client.query('BEGIN');

        // ── Verificar caja ────────────────────────────────────────────────────
        const cajaResult = await client.query(
            `SELECT * FROM cajas WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
            [caja_id, tenant_id]
        );
        if (cajaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Caja no encontrada.' });
        }

        // ── Período desde el último corte ─────────────────────────────────────
        const lastCut = await client.query(
            `SELECT created_at, leave_balance FROM cash_registers
             WHERE caja_id = $1 AND tenant_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [caja_id, tenant_id]
        );
        const since        = lastCut.rowCount > 0 ? lastCut.rows[0].created_at : new Date(0);
        const prev_balance = lastCut.rowCount > 0 ? Number(lastCut.rows[0].leave_balance ?? 0) : 0;

        // ── Ventas del período (solo completadas) ─────────────────────────────
        const totalsResult = await client.query(
            `SELECT
                payment_method,
                COUNT(*)::int                   AS sale_count,
                COALESCE(SUM(total_amount), 0)  AS subtotal
             FROM sales
             WHERE caja_id = $1 AND tenant_id = $2
               AND created_at > $3 AND status = 'completed'
             GROUP BY payment_method`,
            [caja_id, tenant_id, since]
        );

        let total_cash = 0, total_card = 0, total_transfer = 0, total_amount = 0, sales_count = 0;
        for (const row of totalsResult.rows) {
            const amount  = Number(row.subtotal);
            total_amount += amount;
            sales_count  += row.sale_count;
            if (row.payment_method === 'cash')     total_cash     = amount;
            if (row.payment_method === 'card')     total_card     = amount;
            if (row.payment_method === 'transfer') total_transfer = amount;
        }

        // ── Movimientos del período ───────────────────────────────────────────
        const movResult = await client.query(
            `SELECT type, COALESCE(SUM(amount), 0) AS total
             FROM cash_movements
             WHERE caja_id = $1 AND tenant_id = $2 AND created_at > $3
             GROUP BY type`,
            [caja_id, tenant_id, since]
        );

        let movements_in = 0, movements_out = 0;
        for (const row of movResult.rows) {
            if (row.type === 'in')  movements_in  = Number(row.total);
            if (row.type === 'out') movements_out = Number(row.total);
        }

        // ── Efectivo esperado y diferencias ───────────────────────────────────
        const expected_cash = prev_balance + total_cash + movements_in - movements_out;
        const diff_cash     = Number(counted_cash  ?? 0) - expected_cash;
        const diff_card     = Number(counted_card  ?? 0) - total_card;

        // ── Rango de ventas (null si no hubo ventas) ──────────────────────────
        const rangeResult = await client.query(
            `SELECT MIN(created_at) AS sales_from, MAX(created_at) AS sales_to
             FROM sales
             WHERE caja_id = $1 AND tenant_id = $2
               AND created_at > $3 AND status = 'completed'`,
            [caja_id, tenant_id, since]
        );
        const { sales_from, sales_to } = rangeResult.rows[0];

        // ── Folio del corte (autoincremental por caja) ────────────────────────
        const lastFolioResult = await client.query(
            `SELECT COALESCE(MAX(folio_number), 0) AS last_folio
             FROM cash_registers WHERE caja_id = $1`,
            [caja_id]
        );
        const folioNumber = lastFolioResult.rows[0].last_folio + 1;

        // ── Insertar corte ────────────────────────────────────────────────────
        const corteResult = await client.query(
            `INSERT INTO cash_registers
                (tenant_id, caja_id, user_id, folio_number,
                 total_cash, total_card, total_transfer, total_amount,
                 counted_cash, counted_card, diff_cash, diff_card,
                 movements_in, movements_out, leave_balance,
                 sales_from, sales_to, sales_count, notes)
             VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
             RETURNING *`,
            [
                tenant_id,
                caja_id,
                user_id,
                folioNumber,
                Number(total_cash.toFixed(2)),
                Number(total_card.toFixed(2)),
                Number(total_transfer.toFixed(2)),
                Number(total_amount.toFixed(2)),
                Number(Number(counted_cash  ?? 0).toFixed(2)),
                Number(Number(counted_card  ?? 0).toFixed(2)),
                Number(diff_cash.toFixed(2)),
                Number(diff_card.toFixed(2)),
                Number(movements_in.toFixed(2)),
                Number(movements_out.toFixed(2)),
                Number(Number(leave_balance ?? 0).toFixed(2)),
                sales_from,
                sales_to,
                sales_count,
                notes.trim(),
            ]
        );

        await client.query('COMMIT');

        const corte = corteResult.rows[0];

        return res.status(201).json({
            message: 'Corte de caja guardado correctamente.',
            folio:   `C-${String(folioNumber).padStart(4, '0')}`,
            corte,
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en corte de caja:', error);
        return res.status(500).json({ error: 'Error al generar el corte.' });
    } finally {
        client.release();
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   HISTORIAL DE CORTES
═══════════════════════════════════════════════════════════════════════════ */

// GET /api/cash-registers/cortes
router.get('/cortes', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { caja_id } = req.query;

        let queryText = `
            SELECT cr.*,
                   c.name AS caja_name,
                   CONCAT('C-', LPAD(cr.folio_number::text, 4, '0')) AS folio
            FROM cash_registers cr
            LEFT JOIN cajas c ON c.id = cr.caja_id
            WHERE cr.tenant_id = $1
        `;
        const params = [tenant_id];

        if (caja_id) {
            params.push(caja_id);
            queryText += ` AND cr.caja_id = $${params.length}`;
        }
        queryText += ` ORDER BY cr.created_at DESC`;

        const result = await pool.query(queryText, params);
        return res.json(result.rows);
    } catch (error) {
        console.error('Error listando cortes:', error);
        return res.status(500).json({ error: 'Error al obtener los cortes.' });
    }
});

export default router;