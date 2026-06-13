import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory/adjustments
// Lista TODOS los ajustes del tenant (para historial global)
// Query params: from (ISO), to (ISO), page, limit
// ─────────────────────────────────────────────────────────────────────────────
router.get('/adjustments', async (req, res) => {
    const { tenantId } = req.user;
    const page   = Math.max(Number(req.query.page)  || 1,  1);
    const limit  = Math.max(Number(req.query.limit) || 20, 1);
    const offset = (page - 1) * limit;
    const from   = req.query.from || null;
    const to     = req.query.to   || null;

    try {
        const params = [tenantId];
        let whereExtra = '';

        if (from) {
            params.push(from);
            whereExtra += ` AND ia.created_at >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            whereExtra += ` AND ia.created_at <= $${params.length}`;
        }

        const dataParams  = [...params, limit, offset];
        const countParams = [...params];

        const result = await query(
            `SELECT ia.*,
                    u.name  AS user_name,
                    p.name  AS product_name,
                    p.sku   AS product_sku,
                    p.unit  AS product_unit
             FROM inventory_adjustments ia
             LEFT JOIN users    u ON ia.user_id    = u.id
             LEFT JOIN products p ON ia.product_id = p.id
             WHERE ia.tenant_id = $1${whereExtra}
             ORDER BY ia.created_at DESC
             LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
            dataParams
        );

        const count = await query(
            `SELECT COUNT(*)::int AS total
             FROM inventory_adjustments ia
             WHERE ia.tenant_id = $1${whereExtra}`,
            countParams
        );

        res.json({
            data: result.rows,
            pagination: {
                page, limit,
                total: count.rows[0].total,
                pages: Math.ceil(count.rows[0].total / limit)
            }
        });
    } catch (err) {
        console.error('Error fetching all adjustments:', err);
        res.status(500).json({ error: 'Error al obtener los ajustes.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/inventory/adjustments/:productId
// Historial de ajustes de un producto específico
// ─────────────────────────────────────────────────────────────────────────────
router.get('/adjustments/:productId', async (req, res) => {
    const { tenantId } = req.user;
    const { productId } = req.params;

    try {
        const result = await query(
            `SELECT ia.*, u.name AS user_name
             FROM inventory_adjustments ia
             LEFT JOIN users u ON ia.user_id = u.id
             WHERE ia.tenant_id = $1 AND ia.product_id = $2
             ORDER BY ia.created_at DESC`,
            [tenantId, productId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching inventory adjustments:', err);
        res.status(500).json({ error: 'Error al obtener historial de ajustes.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/inventory/adjust
// Realiza un ajuste de inventario (soporta cantidades decimales)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/adjust', async (req, res) => {
    const { tenantId, userId } = req.user;
    const { product_id, type, quantity: rawQuantity, reason } = req.body;

    // Convertir a número flotante desde lo que llegue (string o number)
    const quantity = parseFloat(rawQuantity);

    // ── Validaciones ──────────────────────────────────────────────────────
    if (!product_id || !type || rawQuantity === undefined || rawQuantity === '' || !reason) {
        return res.status(400).json({ error: 'Todos los campos son requeridos para el ajuste.' });
    }

    if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser un número mayor a 0.' });
    }

    if (!['IN', 'OUT'].includes(type)) {
        return res.status(400).json({ error: 'El tipo debe ser IN o OUT.' });
    }

    try {
        await query('BEGIN');

        // Obtener stock actual y datos del producto (incluyendo allow_fractions)
        const productRes = await query(
            'SELECT stock, allow_fractions FROM products WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
            [product_id, tenantId]
        );

        if (productRes.rowCount === 0) {
            await query('ROLLBACK');
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        const { stock: currentStock, allow_fractions } = productRes.rows[0];

        // Si el producto no permite fracciones, rechazar cantidades decimales
        if (!allow_fractions && !Number.isInteger(quantity)) {
            await query('ROLLBACK');
            return res.status(400).json({ error: 'Este producto no permite cantidades fraccionadas.' });
        }

        // Calcular nuevo stock con precisión numérica (evitar errores de punto flotante)
        let newStock;
        if (type === 'IN') {
            newStock = parseFloat((parseFloat(currentStock) + quantity).toFixed(3));
        } else {
            if (parseFloat(currentStock) < quantity) {
                await query('ROLLBACK');
                return res.status(400).json({ error: 'Stock insuficiente para la salida.' });
            }
            newStock = parseFloat((parseFloat(currentStock) - quantity).toFixed(3));
        }

        // Actualizar stock del producto
        await query(
            'UPDATE products SET stock = $1 WHERE id = $2 AND tenant_id = $3',
            [newStock, product_id, tenantId]
        );

        // Registrar ajuste
        const adjRes = await query(
            `INSERT INTO inventory_adjustments (tenant_id, product_id, user_id, type, quantity, reason)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [tenantId, product_id, userId, type, quantity, reason]
        );

        await query('COMMIT');

        res.status(201).json({
            message: 'Ajuste realizado exitosamente',
            newStock,
            adjustment: adjRes.rows[0]
        });

    } catch (err) {
        await query('ROLLBACK');
        console.error('Error in inventory adjustment:', err);
        res.status(500).json({ error: 'Error al procesar el ajuste de inventario.' });
    }
});

export default router;