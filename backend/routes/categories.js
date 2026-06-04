import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Todos los endpoints de categorías están protegidos y requieren un tenant_id (obtenido del token)
router.use(verifyToken);

// GET: Obtener todas las categorías del tenant actual
router.get('/', async (req, res) => {
    const { tenantId } = req.user;

    try {
        const result = await query(
            'SELECT * FROM categories WHERE tenant_id = $1 ORDER BY name ASC',
            [tenantId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ error: 'Error al obtener las categorías.' });
    }
});

// POST: Crear una nueva categoría
router.post('/', async (req, res) => {
    const { tenantId } = req.user;
    const { name, color } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'El nombre de la categoría es requerido.' });
    }

    try {
        const result = await query(
            'INSERT INTO categories (tenant_id, name, color) VALUES ($1, $2, $3) RETURNING *',
            [tenantId, name, color || '#0058be']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating category:', err);
        res.status(500).json({ error: 'Error al crear la categoría.' });
    }
});

// PUT: Actualizar una categoría
router.put('/:id', async (req, res) => {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { name, color } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'El nombre de la categoría es requerido.' });
    }

    try {
        const result = await query(
            'UPDATE categories SET name = $1, color = $2 WHERE id = $3 AND tenant_id = $4 RETURNING *',
            [name, color || '#0058be', id, tenantId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ error: 'Error al actualizar la categoría.' });
    }
});

// DELETE: Eliminar una categoría
router.delete('/:id', async (req, res) => {
    const { tenantId } = req.user;
    const { id } = req.params;

    try {
        const result = await query(
            'DELETE FROM categories WHERE id = $1 AND tenant_id = $2 RETURNING *',
            [id, tenantId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }

        res.json({ message: 'Categoría eliminada exitosamente.', category: result.rows[0] });
    } catch (err) {
        console.error('Error deleting category:', err);
        res.status(500).json({ error: 'Error al eliminar la categoría.' });
    }
});

export default router;
