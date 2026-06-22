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
   Incluye: saldo anterior, ventas por método, movimientos, cancelaciones y
   efectivo/tarjeta esperados.
═══════════════════════════════════════════════════════════════════════════ */

// GET /api/cash-registers/preview?caja_id=X
router.get('/preview', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { caja_id } = req.query;

        if (!caja_id)
            return res.status(400).json({ error: 'caja_id es requerido.' });

        const lastCut = await pool.query(
            `SELECT created_at, leave_balance FROM cash_registers
             WHERE caja_id = $1 AND tenant_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [caja_id, tenant_id]
        );
        const since        = lastCut.rowCount > 0 ? lastCut.rows[0].created_at : new Date(0);
        const prev_balance = lastCut.rowCount > 0 ? Number(lastCut.rows[0].leave_balance ?? 0) : 0;

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

        const cancelResult = await pool.query(
            `SELECT
                payment_method,
                COALESCE(SUM(total_amount), 0) AS subtotal
             FROM sales
             WHERE caja_id = $1 AND tenant_id = $2
               AND status = 'cancelled' AND cancelled_at > $3
             GROUP BY payment_method`,
            [caja_id, tenant_id, since]
        );
        let cancelled_cash = 0, cancelled_card = 0;
        for (const row of cancelResult.rows) {
            if (row.payment_method === 'cash') cancelled_cash = Number(row.subtotal);
            if (row.payment_method === 'card') cancelled_card = Number(row.subtotal);
        }

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

        const expected_cash = prev_balance + sales_cash + movements_in - movements_out - cancelled_cash;
        const expected_card = sales_card - cancelled_card;

        return res.json({
            since,
            sales_count,
            prev_balance:    Number(prev_balance.toFixed(2)),
            sales_cash:      Number(sales_cash.toFixed(2)),
            sales_card:      Number(sales_card.toFixed(2)),
            cancelled_cash:  Number(cancelled_cash.toFixed(2)),
            cancelled_card:  Number(cancelled_card.toFixed(2)),
            movements_in:    Number(movements_in.toFixed(2)),
            movements_out:   Number(movements_out.toFixed(2)),
            expected_cash:   Number(expected_cash.toFixed(2)),
            expected_card:   Number(expected_card.toFixed(2)),
        });
    } catch (error) {
        console.error('Error en preview:', error);
        return res.status(500).json({ error: 'Error al obtener el preview.' });
    }
});

/* ═══════════════════════════════════════════════════════════════════════════
   REALIZAR CORTE
   IMPORTANTE — inmutabilidad: una vez insertado, este registro nunca se
   recalcula ni se modifica. Si después se cancela una venta que cayó dentro
   del período de ESTE corte, ese movimiento se reflejará en el SIGUIENTE
   corte (su "since" arrancará después de este), nunca editando este ya cerrado.
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

        const cajaResult = await client.query(
            `SELECT * FROM cajas WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
            [caja_id, tenant_id]
        );
        if (cajaResult.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Caja no encontrada.' });
        }

        const lastCut = await client.query(
            `SELECT created_at, leave_balance FROM cash_registers
             WHERE caja_id = $1 AND tenant_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [caja_id, tenant_id]
        );
        const since        = lastCut.rowCount > 0 ? lastCut.rows[0].created_at : new Date(0);
        const prev_balance = lastCut.rowCount > 0 ? Number(lastCut.rows[0].leave_balance ?? 0) : 0;

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

        const cancelResult = await client.query(
            `SELECT
                payment_method,
                COALESCE(SUM(total_amount), 0) AS subtotal
             FROM sales
             WHERE caja_id = $1 AND tenant_id = $2
               AND status = 'cancelled' AND cancelled_at > $3
             GROUP BY payment_method`,
            [caja_id, tenant_id, since]
        );
        let cancelled_cash = 0, cancelled_card = 0;
        for (const row of cancelResult.rows) {
            if (row.payment_method === 'cash') cancelled_cash = Number(row.subtotal);
            if (row.payment_method === 'card') cancelled_card = Number(row.subtotal);
        }

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

        const expected_cash = prev_balance + total_cash + movements_in - movements_out - cancelled_cash;
        const expected_card = total_card - cancelled_card;
        const diff_cash      = Number(counted_cash  ?? 0) - expected_cash;
        const diff_card      = Number(counted_card  ?? 0) - expected_card;

        const rangeResult = await client.query(
            `SELECT MIN(created_at) AS sales_from, MAX(created_at) AS sales_to
             FROM sales
             WHERE caja_id = $1 AND tenant_id = $2
               AND created_at > $3 AND status = 'completed'`,
            [caja_id, tenant_id, since]
        );
        const { sales_from, sales_to } = rangeResult.rows[0];

        const lastFolioResult = await client.query(
            `SELECT COALESCE(MAX(folio_number), 0) AS last_folio
             FROM cash_registers WHERE caja_id = $1`,
            [caja_id]
        );
        const folioNumber = lastFolioResult.rows[0].last_folio + 1;

        const corteResult = await client.query(
            `INSERT INTO cash_registers
                (tenant_id, caja_id, user_id, folio_number,
                 total_cash, total_card, total_transfer, total_amount,
                 counted_cash, counted_card, diff_cash, diff_card,
                 movements_in, movements_out, leave_balance, prev_balance,
                 sales_from, sales_to, sales_count, notes)
             VALUES
                ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
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
                Number(prev_balance.toFixed(2)),
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

/* ═══════════════════════════════════════════════════════════════════════════
   DETALLE DE BITÁCORA DE UN CORTE
   ───────────────────────────────────────────────────────────────────────────
   Reconstruye, para un corte ya guardado, la línea de tiempo de eventos que
   movieron efectivo y tarjeta durante su período. El "since" real de este
   corte se infiere del corte INMEDIATAMENTE ANTERIOR a él en esa misma caja
   — igual que se hizo al momento de crearlo — así el detalle de un corte
   antiguo sigue siendo fiel a su propio período, sin importar cuántos
   cortes nuevos se hayan hecho después.

   Devuelve dos arreglos separados (cash_ledger, card_ledger), cada uno con
   saldo corriente, para mostrarlos como dos bitácoras independientes.
═══════════════════════════════════════════════════════════════════════════ */

// GET /api/cash-registers/cortes/:id/detail
router.get('/cortes/:id/detail', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { id } = req.params;

        const corteResult = await pool.query(
            `SELECT * FROM cash_registers WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );
        if (corteResult.rowCount === 0)
            return res.status(404).json({ error: 'Corte no encontrado.' });

        const corte = corteResult.rows[0];
        const { caja_id } = corte;

        const prevCutResult = await pool.query(
            `SELECT created_at FROM cash_registers
             WHERE caja_id = $1 AND tenant_id = $2 AND created_at < $3
             ORDER BY created_at DESC LIMIT 1`,
            [caja_id, tenant_id, corte.created_at]
        );
        const since = prevCutResult.rowCount > 0 ? prevCutResult.rows[0].created_at : new Date(0);
        const until = corte.created_at;

        const salesResult = await pool.query(
            `SELECT s.id, s.payment_method, s.total_amount, s.created_at,
                    s.user_id, u.name AS user_name
             FROM sales s
             LEFT JOIN users u ON u.id = s.user_id
             WHERE s.caja_id = $1 AND s.tenant_id = $2
               AND s.created_at > $3 AND s.created_at <= $4
               AND s.status = 'completed'
             ORDER BY s.created_at ASC`,
            [caja_id, tenant_id, since, until]
        );

        const cancelResult = await pool.query(
            `SELECT s.id, s.payment_method, s.total_amount, s.cancelled_at,
                    s.cancelled_by, u.name AS user_name
             FROM sales s
             LEFT JOIN users u ON u.id = s.cancelled_by
             WHERE s.caja_id = $1 AND s.tenant_id = $2
               AND s.cancelled_at > $3 AND s.cancelled_at <= $4
               AND s.status = 'cancelled'
             ORDER BY s.cancelled_at ASC`,
            [caja_id, tenant_id, since, until]
        );

        const movResult = await pool.query(
            `SELECT cm.id, cm.type, cm.amount, cm.reason, cm.created_at,
                    cm.user_id, u.name AS user_name
             FROM cash_movements cm
             LEFT JOIN users u ON u.id = cm.user_id
             WHERE cm.caja_id = $1 AND cm.tenant_id = $2
               AND cm.created_at > $3 AND cm.created_at <= $4
             ORDER BY cm.created_at ASC`,
            [caja_id, tenant_id, since, until]
        );

        const cashEvents = [];
        const cardEvents = [];

        for (const s of salesResult.rows) {
            const target = s.payment_method === 'card' ? cardEvents
                          : s.payment_method === 'cash' ? cashEvents
                          : null;
            if (!target) continue;
            target.push({
                type: 'in',
                category: 'venta',
                label: 'Venta',
                amount: Number(s.total_amount),
                at: s.created_at,
                user_name: s.user_name ?? null,
                ref_id: s.id,
            });
        }

        for (const s of cancelResult.rows) {
            const target = s.payment_method === 'card' ? cardEvents
                          : s.payment_method === 'cash' ? cashEvents
                          : null;
            if (!target) continue;
            target.push({
                type: 'out',
                category: 'cancelacion',
                label: 'Cancelación',
                amount: Number(s.total_amount),
                at: s.cancelled_at,
                user_name: s.user_name ?? null,
                ref_id: s.id,
            });
        }

        for (const m of movResult.rows) {
            cashEvents.push({
                type: m.type === 'in' ? 'in' : 'out',
                category: 'movimiento',
                label: m.reason?.trim() ? `Movimiento — ${m.reason.trim()}` : 'Movimiento',
                amount: Number(m.amount),
                at: m.created_at,
                user_name: m.user_name ?? null,
                ref_id: m.id,
            });
        }

        function buildLedger(events, startingBalance) {
            events.sort((a, b) => new Date(a.at) - new Date(b.at));
            let running = startingBalance;
            return events.map(e => {
                running = e.type === 'in'
                    ? Number((running + e.amount).toFixed(2))
                    : Number((running - e.amount).toFixed(2));
                return { ...e, running_balance: running };
            });
        }

        const cash_ledger = buildLedger(cashEvents, Number(corte.prev_balance ?? 0));
        const card_ledger = buildLedger(cardEvents, 0);

        return res.json({
            corte_id: corte.id,
            folio: `C-${String(corte.folio_number).padStart(4, '0')}`,
            since,
            until,
            opening_cash_balance: Number(corte.prev_balance ?? 0),
            cash_ledger,
            card_ledger,
        });

    } catch (error) {
        console.error('Error en detalle de corte:', error);
        return res.status(500).json({ error: 'Error al obtener el detalle del corte.' });
    }
});

export default router;