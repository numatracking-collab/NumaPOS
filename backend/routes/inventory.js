import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

// GET: Historial de ajustes de un producto
router.get('/adjustments/:productId', async (req, res) => {
    const { tenantId } = req.user;
    const { productId } = req.params;

    try {
        const result = await query(
            `SELECT ia.*, u.name as user_name 
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

// POST: Realizar un ajuste de inventario
router.post('/adjust', async (req, res) => {
    const { tenantId, userId } = req.user;
    const { product_id, type, quantity, reason } = req.body;

    if (!product_id || !type || !quantity || !reason) {
        return res.status(400).json({ error: 'Todos los campos son requeridos para el ajuste.' });
    }

    if (quantity <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser mayor a 0.' });
    }

    if (!['IN', 'OUT'].includes(type)) {
        return res.status(400).json({ error: 'El tipo debe ser IN o OUT.' });
    }

    try {
        // Transacción
        await query('BEGIN');

        // Obtener stock actual
        const productRes = await query(
            'SELECT stock FROM products WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
            [product_id, tenantId]
        );

        if (productRes.rowCount === 0) {
            await query('ROLLBACK');
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        const currentStock = productRes.rows[0].stock;
        let newStock = currentStock;

        if (type === 'IN') {
            newStock += quantity;
        } else if (type === 'OUT') {
            if (currentStock < quantity) {
                await query('ROLLBACK');
                return res.status(400).json({ error: 'Stock insuficiente para la salida.' });
            }
            newStock -= quantity;
        }

        // Actualizar producto
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
