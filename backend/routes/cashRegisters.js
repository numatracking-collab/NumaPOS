import express from 'express';
import { pool, query } from '../config/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cash-registers/cajas  — Lista de cajas del tenant
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cash-registers/cajas  — Crear una caja física
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cash-registers/corte  — Realizar corte de caja
//
// Suma todas las ventas de la caja indicada desde el último corte hasta ahora.
// Desglosa por método de pago. Asigna folio de corte y guarda el registro.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/corte', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id, userId: user_id } = req.user;
        const { caja_id, notes = '' } = req.body;

        if (!caja_id)
            return res.status(400).json({ error: 'Debes indicar el caja_id para el corte.' });

        await client.query('BEGIN');

        // ── 1. Verificar que la caja existe y pertenece al tenant ─────────────
        const cajaResult = await client.query(
            `SELECT * FROM cajas WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
            [caja_id, tenant_id]
        );
        if (cajaResult.rowCount === 0)
            return res.status(404).json({ error: 'Caja no encontrada.' });

        // ── 2. Fecha del último corte (para saber desde cuándo sumar) ─────────
        const lastCut = await client.query(
            `SELECT created_at FROM cash_registers
             WHERE caja_id = $1 AND tenant_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [caja_id, tenant_id]
        );
        const since = lastCut.rowCount > 0 ? lastCut.rows[0].created_at : new Date(0);

        // ── 3. Sumar ventas por método de pago desde el último corte ──────────
        const totalsResult = await client.query(
            `SELECT
                payment_method,
                COUNT(*)::int         AS sale_count,
                SUM(total_amount)     AS subtotal
             FROM sales
             WHERE caja_id = $1
               AND tenant_id = $2
               AND created_at > $3
             GROUP BY payment_method`,
            [caja_id, tenant_id, since]
        );

        // Si no hay ventas desde el último corte
        if (totalsResult.rowCount === 0)
            return res.status(400).json({ error: 'No hay ventas nuevas desde el último corte.' });

        let total_cash     = 0;
        let total_card     = 0;
        let total_transfer = 0;
        let total_amount   = 0;
        let sales_count    = 0;

        for (const row of totalsResult.rows) {
            const amount = Number(row.subtotal);
            total_amount  += amount;
            sales_count   += row.sale_count;

            if (row.payment_method === 'cash')       total_cash     = amount;
            if (row.payment_method === 'card')       total_card     = amount;
            if (row.payment_method === 'transfer')   total_transfer = amount;
        }

        total_amount = Number(total_amount.toFixed(2));

        // Rango real de ventas incluidas
        const rangeResult = await client.query(
            `SELECT MIN(created_at) AS sales_from, MAX(created_at) AS sales_to
             FROM sales
             WHERE caja_id = $1 AND tenant_id = $2 AND created_at > $3`,
            [caja_id, tenant_id, since]
        );
        const { sales_from, sales_to } = rangeResult.rows[0];

        // ── 4. Folio del corte (autoincremental por caja) ─────────────────────
        const lastFolioResult = await client.query(
            `SELECT COALESCE(MAX(folio_number), 0) AS last_folio
             FROM cash_registers WHERE caja_id = $1`,
            [caja_id]
        );
        const folioNumber = lastFolioResult.rows[0].last_folio + 1;

        // ── 5. Guardar el corte ───────────────────────────────────────────────
        const corteResult = await client.query(
            `INSERT INTO cash_registers
                (tenant_id, caja_id, user_id, folio_number,
                 total_cash, total_card, total_transfer, total_amount,
                 sales_from, sales_to, sales_count, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [
                tenant_id, caja_id, user_id, folioNumber,
                Number(total_cash.toFixed(2)),
                Number(total_card.toFixed(2)),
                Number(total_transfer.toFixed(2)),
                total_amount,
                sales_from, sales_to, sales_count, notes,
            ]
        );

        await client.query('COMMIT');

        const corte = corteResult.rows[0];

        return res.status(201).json({
            message:        'Corte de caja generado correctamente.',
            folio:          `C-${String(folioNumber).padStart(4, '0')}`,
            corte,
            desglose: {
                efectivo:       Number(total_cash.toFixed(2)),
                tarjeta:        Number(total_card.toFixed(2)),
                transferencia:  Number(total_transfer.toFixed(2)),
                total:          total_amount,
            },
            sales_count,
            period: { from: sales_from, to: sales_to },
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en corte de caja:', error);
        return res.status(500).json({ error: 'Error al generar el corte.' });
    } finally {
        client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cash-registers/cortes  — Historial de cortes
// ─────────────────────────────────────────────────────────────────────────────
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
            params.push(Number(caja_id));
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

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/cash-registers/preview  — Preview del próximo corte (sin guardarlo)
// Útil para mostrar el resumen antes de confirmar el corte
// ─────────────────────────────────────────────────────────────────────────────
router.get('/preview', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { caja_id } = req.query;

        if (!caja_id)
            return res.status(400).json({ error: 'caja_id es requerido.' });

        const lastCut = await pool.query(
            `SELECT created_at FROM cash_registers
             WHERE caja_id = $1 AND tenant_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [caja_id, tenant_id]
        );
        const since = lastCut.rowCount > 0 ? lastCut.rows[0].created_at : new Date(0);

        const totals = await pool.query(
            `SELECT
                payment_method,
                COUNT(*)::int     AS sale_count,
                SUM(total_amount) AS subtotal
             FROM sales
             WHERE caja_id = $1 AND tenant_id = $2 AND created_at > $3
             GROUP BY payment_method`,
            [caja_id, tenant_id, since]
        );

        let total_cash = 0, total_card = 0, total_transfer = 0, total_amount = 0, sales_count = 0;

        for (const row of totals.rows) {
            const amount = Number(row.subtotal);
            total_amount += amount;
            sales_count  += row.sale_count;
            if (row.payment_method === 'cash')     total_cash     = amount;
            if (row.payment_method === 'card')     total_card     = amount;
            if (row.payment_method === 'transfer') total_transfer = amount;
        }

        return res.json({
            since,
            sales_count,
            desglose: {
                efectivo:      Number(total_cash.toFixed(2)),
                tarjeta:       Number(total_card.toFixed(2)),
                transferencia: Number(total_transfer.toFixed(2)),
                total:         Number(total_amount.toFixed(2)),
            }
        });
    } catch (error) {
        console.error('Error en preview:', error);
        return res.status(500).json({ error: 'Error al obtener el preview.' });
    }
});

export default router;