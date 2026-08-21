import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const SALT_ROUNDS = 12;

function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = (n) => Array.from(
        { length: n },
        () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    return `${segment(5)}-${segment(5)}`;
}

function signToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
}

// ──────────────────────────────────────────────
// POST /api/auth/register
// ──────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const { businessName, ownerName, email, phone, password } = req.body;

    if (!businessName || !ownerName || !email || !password)
        return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
    if (!email.includes('@'))
        return res.status(400).json({ error: 'El formato del email no es válido.' });
    if (password.length < 6)
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });

    try {
        const existingTenant = await query('SELECT id FROM tenants WHERE email = $1', [email]);
        if (existingTenant.rows.length > 0)
            return res.status(409).json({ error: 'Ya existe una cuenta registrada con este email.' });

        const tenantResult = await query(
            'INSERT INTO tenants (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
            [businessName, email]
        );
        const tenant = tenantResult.rows[0];

        const licenseKey = generateLicenseKey();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await query(
            'INSERT INTO licences (tenant_id, plan_type, status, expires_at, key) VALUES ($1, $2, $3, $4, $5)',
            [tenant.id, 'free', 'active', expiresAt.toISOString(), licenseKey]
        );

        // ── Rol "Admin" (dueño) por defecto, con TODOS los permisos ─────────
        const roleResult = await query(
            'INSERT INTO roles (tenant_id, name, is_owner_role) VALUES ($1, $2, $3) RETURNING id, name',
            [tenant.id, 'Admin', true]
        );
        const adminRole = roleResult.rows[0];

        await query(
            'INSERT INTO role_permissions (role_id, permission_id) SELECT $1, id FROM permissions',
            [adminRole.id]
        );

        // ── Rol "Cajero" por defecto, listo para cuando agregue empleados ───
        const cajeroResult = await query(
            'INSERT INTO roles (tenant_id, name, is_owner_role) VALUES ($1, $2, $3) RETURNING id',
            [tenant.id, 'Cajero', false]
        );
        await query(
            `INSERT INTO role_permissions (role_id, permission_id)
             SELECT $1, id FROM permissions
             WHERE code IN ('caja.open', 'caja.movement', 'corte.create', 'sale.cancel', 'product.view_stock')`,
            [cajeroResult.rows[0].id]
        );

        const allPerms = await query('SELECT code FROM permissions ORDER BY category, label');
        const permissionCodes = allPerms.rows.map(r => r.code);

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const userResult = await query(
            `INSERT INTO users (tenant_id, name, email, password_hash, role, role_id)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role`,
            [tenant.id, ownerName, email, passwordHash, 'admin', adminRole.id]
        );
        const user = userResult.rows[0];

        const token = signToken({
            tenantId: tenant.id,
            userId:   user.id,
            email:    user.email,
            name:     user.name,
            role:     user.role,
        });

        res.status(201).json({
            token,
            user: {
                id: user.id, name: user.name, email: user.email, role: user.role,
                roleId: adminRole.id, roleName: adminRole.name, permissions: permissionCodes,
            },
            tenant: { id: tenant.id, name: tenant.name, email: tenant.email },
            license: {
                key:       licenseKey,
                plan:      'free',
                status:    'active',
                expiresAt: expiresAt.toISOString(),
            },
        });

    } catch (err) {
        console.error('Error en registro:', err);
        res.status(500).json({ error: 'Error interno del servidor al crear la cuenta.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/auth/me
// ──────────────────────────────────────────────
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
        return res.status(401).json({ error: 'Token no proporcionado.' });

    let decoded;
    try {
        decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }

    try {
        const result = await query(
            `SELECT u.id, u.name, u.email, u.role, u.is_active,
                    t.id   AS tenant_id,   t.name AS tenant_name,
                    l.plan_type, l.status  AS license_status,
                    l.expires_at,          l.key  AS license_key,
                    r.id   AS role_id,     r.name AS role_name,
                    COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
             FROM users u
             JOIN tenants t  ON t.id = u.tenant_id
             LEFT JOIN licences l ON l.tenant_id = t.id
             LEFT JOIN roles r ON r.id = u.role_id
             LEFT JOIN role_permissions rp ON rp.role_id = r.id
             LEFT JOIN permissions p ON p.id = rp.permission_id
             WHERE u.id = $1
             GROUP BY u.id, u.name, u.email, u.role, u.is_active, t.id, t.name,
                      l.plan_type, l.status, l.expires_at, l.key, l.created_at, r.id, r.name
             ORDER BY l.created_at DESC
             LIMIT 1`,
            [decoded.userId]
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Usuario no encontrado.' });

        const row = result.rows[0];
        res.json({
            user: {
                id: row.id, name: row.name, email: row.email, role: row.role,
                isActive: row.is_active, roleId: row.role_id, roleName: row.role_name,
                permissions: row.permissions || [],
            },
            tenant: { id: row.tenant_id, name: row.tenant_name },
            license: row.plan_type ? {
                plan:      row.plan_type,
                status:    row.license_status,
                expiresAt: row.expires_at,
                key:       row.license_key || null,
            } : null,
        });

    } catch (err) {
        console.error('Error en /auth/me:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ──────────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────────
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ error: 'Email y contraseña son requeridos.' });

    try {
        const result = await query(
            `SELECT u.id AS user_id, u.name AS user_name, u.email, u.password_hash, u.role,
                    u.is_active, u.role_id, r.name AS role_name,
                    t.id AS tenant_id, t.name AS tenant_name, t.email AS tenant_email,
                    COALESCE(array_agg(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
             FROM users u
             JOIN tenants t ON t.id = u.tenant_id
             LEFT JOIN roles r ON r.id = u.role_id
             LEFT JOIN role_permissions rp ON rp.role_id = r.id
             LEFT JOIN permissions p ON p.id = rp.permission_id
             WHERE u.email = $1
             GROUP BY u.id, u.name, u.email, u.password_hash, u.role, u.is_active, u.role_id,
                      r.name, t.id, t.name, t.email
             LIMIT 1`,
            [email]
        );

        if (result.rows.length === 0)
            return res.status(401).json({ error: 'Credenciales inválidas.' });

        const row = result.rows[0];

        const isPasswordValid = await bcrypt.compare(password, row.password_hash);
        if (!isPasswordValid)
            return res.status(401).json({ error: 'Credenciales inválidas.' });

        // ── Usuario desactivado por el dueño del negocio ─────────────────
        if (row.is_active === false)
            return res.status(403).json({
                error: 'Tu usuario ha sido desactivado. Contacta al administrador de tu negocio.',
                code:  'USER_INACTIVE',
            });

        const licenceResult = await query(
            `SELECT plan_type, status, expires_at, key
             FROM licences
             WHERE tenant_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [row.tenant_id]
        );

        const licence = licenceResult.rows[0] || null;

        const token = signToken({
            tenantId: row.tenant_id,
            userId:   row.user_id,
            email:    row.email,
            name:     row.user_name,
            role:     row.role,
        });

        res.json({
            token,
            user: {
                id: row.user_id, name: row.user_name, email: row.email, role: row.role,
                roleId: row.role_id, roleName: row.role_name, permissions: row.permissions || [],
            },
            tenant: { id: row.tenant_id, name: row.tenant_name, email: row.tenant_email },
            license: licence ? {
                plan:      licence.plan_type,
                status:    licence.status,
                expiresAt: licence.expires_at,
                key:       licence.key || null,
            } : null,
        });

    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;