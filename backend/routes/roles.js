import express from 'express';
import { pool } from '../config/db.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();

router.use(verifyToken);

// ──────────────────────────────────────────────
// GET /api/roles/permissions  → catálogo completo (para armar la matriz en UI)
// IMPORTANTE: va ANTES de GET /:id para que Express no confunda "permissions"
// con un :id.
// ──────────────────────────────────────────────
router.get('/permissions', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, code, category, label FROM permissions ORDER BY category, label'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error listando permisos:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/roles  → roles del tenant, con sus permisos y cantidad de usuarios
// ──────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.id, r.name, r.is_owner_role, r.created_at,
                    COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions,
                    COUNT(DISTINCT u.id) AS user_count
             FROM roles r
             LEFT JOIN role_permissions rp ON rp.role_id = r.id
             LEFT JOIN permissions p ON p.id = rp.permission_id
             LEFT JOIN users u ON u.role_id = r.id
             WHERE r.tenant_id = $1
             GROUP BY r.id
             ORDER BY r.is_owner_role DESC, r.created_at ASC`,
            [req.user.tenantId]
        );
        res.json(result.rows.map(r => ({ ...r, user_count: Number(r.user_count) })));
    } catch (err) {
        console.error('Error listando roles:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ──────────────────────────────────────────────
// POST /api/roles  → crear rol nuevo
// body: { name, permissionCodes: string[] }
// ──────────────────────────────────────────────
router.post('/', requirePermission('users.manage'), async (req, res) => {
    const { name, permissionCodes = [] } = req.body;

    if (!name || !name.trim())
        return res.status(400).json({ error: 'El nombre del rol es obligatorio.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existing = await client.query(
            'SELECT id FROM roles WHERE tenant_id = $1 AND name = $2',
            [req.user.tenantId, name.trim()]
        );
        if (existing.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe un rol con ese nombre.' });
        }

        const roleResult = await client.query(
            'INSERT INTO roles (tenant_id, name) VALUES ($1, $2) RETURNING id, name, is_owner_role, created_at',
            [req.user.tenantId, name.trim()]
        );
        const role = roleResult.rows[0];

        if (permissionCodes.length > 0) {
            await client.query(
                `INSERT INTO role_permissions (role_id, permission_id)
                 SELECT $1, id FROM permissions WHERE code = ANY($2::text[])`,
                [role.id, permissionCodes]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ ...role, permissions: permissionCodes, user_count: 0 });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creando rol:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// ──────────────────────────────────────────────
// PUT /api/roles/:id  → renombrar rol y/o reemplazar sus permisos
// body: { name?, permissionCodes? }
// ──────────────────────────────────────────────
router.put('/:id', requirePermission('users.manage'), async (req, res) => {
    const { id } = req.params;
    const { name, permissionCodes } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const roleCheck = await client.query(
            'SELECT id, is_owner_role FROM roles WHERE id = $1 AND tenant_id = $2',
            [id, req.user.tenantId]
        );
        if (roleCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Rol no encontrado.' });
        }

        if (name && name.trim()) {
            await client.query('UPDATE roles SET name = $1 WHERE id = $2', [name.trim(), id]);
        }

        if (Array.isArray(permissionCodes)) {
            // No permitimos dejar al rol del dueño sin ningún permiso
            if (roleCheck.rows[0].is_owner_role && permissionCodes.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'El rol del dueño debe conservar al menos un permiso.' });
            }
            await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);
            if (permissionCodes.length > 0) {
                await client.query(
                    `INSERT INTO role_permissions (role_id, permission_id)
                     SELECT $1, id FROM permissions WHERE code = ANY($2::text[])`,
                    [id, permissionCodes]
                );
            }
        }

        await client.query('COMMIT');

        const updated = await pool.query(
            `SELECT r.id, r.name, r.is_owner_role,
                    COALESCE(array_agg(DISTINCT p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
             FROM roles r
             LEFT JOIN role_permissions rp ON rp.role_id = r.id
             LEFT JOIN permissions p ON p.id = rp.permission_id
             WHERE r.id = $1
             GROUP BY r.id`,
            [id]
        );
        res.json(updated.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error actualizando rol:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    } finally {
        client.release();
    }
});

// ──────────────────────────────────────────────
// DELETE /api/roles/:id
// ──────────────────────────────────────────────
router.delete('/:id', requirePermission('users.manage'), async (req, res) => {
    const { id } = req.params;

    try {
        const roleCheck = await pool.query(
            'SELECT id, is_owner_role FROM roles WHERE id = $1 AND tenant_id = $2',
            [id, req.user.tenantId]
        );
        if (roleCheck.rows.length === 0)
            return res.status(404).json({ error: 'Rol no encontrado.' });

        if (roleCheck.rows[0].is_owner_role)
            return res.status(400).json({ error: 'No puedes eliminar el rol del dueño.' });

        const usersWithRole = await pool.query(
            'SELECT COUNT(*)::int AS count FROM users WHERE role_id = $1',
            [id]
        );
        if (usersWithRole.rows[0].count > 0)
            return res.status(409).json({ error: 'No puedes eliminar un rol con usuarios asignados. Reasígnalos primero.' });

        await pool.query('DELETE FROM roles WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error eliminando rol:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;