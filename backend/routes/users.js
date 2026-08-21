import express from 'express';
import bcrypt from 'bcrypt';
import { pool } from '../config/db.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();
const SALT_ROUNDS = 12;

router.use(verifyToken);

// ──────────────────────────────────────────────
// GET /api/users  → usuarios del tenant
// ──────────────────────────────────────────────
router.get('/', requirePermission('users.manage'), async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.id, u.name, u.email, u.is_active, u.created_at,
                    r.id AS role_id, r.name AS role_name
             FROM users u
             LEFT JOIN roles r ON r.id = u.role_id
             WHERE u.tenant_id = $1
             ORDER BY u.created_at ASC`,
            [req.user.tenantId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error listando usuarios:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ──────────────────────────────────────────────
// POST /api/users  → crear usuario dentro del mismo tenant
// body: { name, email, password, roleId }
// ──────────────────────────────────────────────
router.post('/', requirePermission('users.manage'), async (req, res) => {
    const { name, email, password, roleId } = req.body;

    if (!name || !email || !password || !roleId)
        return res.status(400).json({ error: 'Nombre, email, contraseña y rol son obligatorios.' });
    if (!email.includes('@'))
        return res.status(400).json({ error: 'El formato del email no es válido.' });
    if (password.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    try {
        const roleCheck = await pool.query(
            'SELECT id FROM roles WHERE id = $1 AND tenant_id = $2',
            [roleId, req.user.tenantId]
        );
        if (roleCheck.rows.length === 0)
            return res.status(400).json({ error: 'El rol seleccionado no es válido.' });

        const existing = await pool.query(
            'SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
            [req.user.tenantId, email]
        );
        if (existing.rows.length > 0)
            return res.status(409).json({ error: 'Ya existe un usuario con ese email en tu negocio.' });

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        // 'role' (varchar legado) se deja en 'cashier' — lo que manda ahora es role_id
        const result = await pool.query(
            `INSERT INTO users (tenant_id, name, email, password_hash, role, role_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, name, email, is_active, created_at`,
            [req.user.tenantId, name, email, passwordHash, 'cashier', roleId]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creando usuario:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ──────────────────────────────────────────────
// PUT /api/users/:id  → editar nombre / email / rol / (opcional) nueva contraseña
// body: { name?, email?, roleId?, password? }
// ──────────────────────────────────────────────
router.put('/:id', requirePermission('users.manage'), async (req, res) => {
    const { id } = req.params;
    const { name, email, roleId, password } = req.body;

    try {
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
            [id, req.user.tenantId]
        );
        if (userCheck.rows.length === 0)
            return res.status(404).json({ error: 'Usuario no encontrado.' });

        if (roleId) {
            const roleCheck = await pool.query(
                'SELECT id FROM roles WHERE id = $1 AND tenant_id = $2',
                [roleId, req.user.tenantId]
            );
            if (roleCheck.rows.length === 0)
                return res.status(400).json({ error: 'El rol seleccionado no es válido.' });
        }

        const fields = [];
        const values = [];
        let i = 1;

        if (name)  { fields.push(`name = $${i++}`);   values.push(name); }
        if (email) { fields.push(`email = $${i++}`);  values.push(email); }
        if (roleId) { fields.push(`role_id = $${i++}`); values.push(roleId); }
        if (password) {
            if (password.length < 6)
                return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
            fields.push(`password_hash = $${i++}`);
            values.push(passwordHash);
        }

        if (fields.length === 0)
            return res.status(400).json({ error: 'No hay cambios que aplicar.' });

        values.push(id);
        const result = await pool.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, email, is_active, role_id`,
            values
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error actualizando usuario:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ──────────────────────────────────────────────
// PATCH /api/users/:id/status  → activar / desactivar
// NO se implementa DELETE: los usuarios están referenciados por ventas, cortes,
// movimientos de caja, ajustes de inventario, etc. Borrarlos rompería ese
// historial (o fallaría por las llaves foráneas). Desactivar es lo seguro.
// body: { isActive: boolean }
// ──────────────────────────────────────────────
router.patch('/:id/status', requirePermission('users.manage'), async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean')
        return res.status(400).json({ error: 'isActive debe ser true o false.' });

    if (id === req.user.userId)
        return res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });

    try {
        const userCheck = await pool.query(
            `SELECT u.id, r.is_owner_role
             FROM users u
             LEFT JOIN roles r ON r.id = u.role_id
             WHERE u.id = $1 AND u.tenant_id = $2`,
            [id, req.user.tenantId]
        );
        if (userCheck.rows.length === 0)
            return res.status(404).json({ error: 'Usuario no encontrado.' });

        // Evita dejar el tenant sin ningún usuario activo con el rol de dueño
        if (!isActive && userCheck.rows[0].is_owner_role) {
            const activeOwners = await pool.query(
                `SELECT COUNT(*)::int AS count
                 FROM users u
                 JOIN roles r ON r.id = u.role_id
                 WHERE u.tenant_id = $1 AND r.is_owner_role = true AND u.is_active = true AND u.id != $2`,
                [req.user.tenantId, id]
            );
            if (activeOwners.rows[0].count === 0)
                return res.status(400).json({ error: 'Debe quedar al menos un usuario activo con el rol de dueño.' });
        }

        const result = await pool.query(
            'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, is_active',
            [isActive, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error cambiando estado de usuario:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;