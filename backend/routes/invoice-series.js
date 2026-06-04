import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();
// Nota: verifyToken se asume global en server.js (igual que cash-registers.js)
// Si tu server.js NO lo aplica globalmente, agrega:
//   import { verifyToken } from '../middleware/authMiddleware.js';
//   router.use(verifyToken);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/invoice-series  — Lista todas las series del tenant
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;

        const result = await pool.query(
            `SELECT * FROM invoice_series
             WHERE tenant_id = $1
             ORDER BY is_default DESC, name ASC`,
            [tenant_id]
        );
        return res.json(result.rows);
    } catch (error) {
        console.error('Error listando series:', error);
        return res.status(500).json({ error: 'Error al obtener las series.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invoice-series  — Crear una nueva serie
// Body: { name, prefix, next_folio? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { name, prefix = '', next_folio = 1 } = req.body;

        if (!name?.trim())
            return res.status(400).json({ error: 'El nombre de la serie es requerido.' });
        if (!prefix?.trim())
            return res.status(400).json({ error: 'El prefijo es requerido.' });

        // Si es la primera serie del tenant, marcarla como default automáticamente
        const count = await pool.query(
            `SELECT COUNT(*)::int AS total FROM invoice_series WHERE tenant_id = $1`,
            [tenant_id]
        );
        const isFirst = count.rows[0].total === 0;

        const result = await pool.query(
            `INSERT INTO invoice_series (tenant_id, name, prefix, next_folio, is_default)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [
                tenant_id,
                name.trim(),
                prefix.trim().toUpperCase(),
                Math.max(1, Number(next_folio) || 1),
                isFirst,
            ]
        );
        return res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505')
            return res.status(400).json({ error: 'Ya existe una serie con ese prefijo.' });
        console.error('Error creando serie:', error);
        return res.status(500).json({ error: 'Error al crear la serie.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/invoice-series/:id/default  — Establecer como serie por defecto
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/default', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id } = req.user;
        const id = Number(req.params.id);

        await client.query('BEGIN');

        // Quitar default de todas las series del tenant
        await client.query(
            `UPDATE invoice_series SET is_default = false WHERE tenant_id = $1`,
            [tenant_id]
        );

        // Asignar default a la seleccionada
        const result = await client.query(
            `UPDATE invoice_series
             SET is_default = true
             WHERE id = $1 AND tenant_id = $2
             RETURNING *`,
            [id, tenant_id]
        );

        if (result.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Serie no encontrada.' });
        }

        await client.query('COMMIT');
        return res.json(result.rows[0]);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error actualizando serie default:', error);
        return res.status(500).json({ error: 'Error al actualizar la serie.' });
    } finally {
        client.release();
    }
});

export default router;