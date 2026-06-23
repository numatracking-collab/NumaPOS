import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const SALT_ROUNDS = 12;

/**
 * Genera una licencia con formato NUMA-XXXX-XXXX-XXXX
 */
// ── Reemplaza la función generateLicenseKey completa ─────────────────────
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segment = (n) => Array.from(
        { length: n },
        () => chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    return `${segment(5)}-${segment(5)}`;  // Ej: A1B2D-C3D4T
}

/**
 * Genera un token JWT con los datos del usuario y tenant.
 */
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

    // Validaciones básicas
    if (!businessName || !ownerName || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
    }

    if (!email.includes('@')) {
        return res.status(400).json({ error: 'El formato del email no es válido.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    try {
        // 1. Verificar que no exista un tenant con ese email
        const existingTenant = await query('SELECT id FROM tenants WHERE email = $1', [email]);
        if (existingTenant.rows.length > 0) {
            return res.status(409).json({ error: 'Ya existe una cuenta registrada con este email.' });
        }

        // 2. Crear el tenant
        const tenantResult = await query(
            'INSERT INTO tenants (name, email) VALUES ($1, $2) RETURNING id, name, email, created_at',
            [businessName, email]
        );
        const tenant = tenantResult.rows[0];

        // 3. Crear la licencia (plan free, activa, expira en 30 días)
        // ── Reemplaza el INSERT de licencia (paso 3 del register) ────────────────
        const licenseKey = generateLicenseKey();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await query(
            'INSERT INTO licences (tenant_id, plan_type, status, expires_at, key) VALUES ($1, $2, $3, $4, $5)',
            [tenant.id, 'free', 'active', expiresAt.toISOString(), licenseKey]
        );

        await query(
            'INSERT INTO licences (tenant_id, plan_type, status, expires_at) VALUES ($1, $2, $3, $4)',
            [tenant.id, 'free', 'active', expiresAt.toISOString()]
        );

        // 4. Hashear la contraseña y crear el usuario admin
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const userResult = await query(
            'INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role',
            [tenant.id, ownerName, email, passwordHash, 'admin']
        );
        const user = userResult.rows[0];

        // 5. Generar JWT
        const token = signToken({
            tenantId: tenant.id,
            userId: user.id,
            email: user.email,
            name: user.name,       // ← agregar
            role: user.role,
        });


        // 6. Responder
        res.status(201).json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                email: tenant.email
            },
            license: {
                key: licenseKey,
                plan: 'free',
                status: 'active',
                expiresAt: expiresAt.toISOString()
            }
        });

    } catch (err) {
        console.error('Error en registro:', err);
        res.status(500).json({ error: 'Error interno del servidor al crear la cuenta.' });
    }
});

// ──────────────────────────────────────────────
// GET /api/auth/me   (requiere JWT)
// ──────────────────────────────────────────────
router.get('/me', async (req, res) => {
    // verifyToken lo montas a nivel de app.use('/api/auth') 
    // pero /register y /login son públicos, así que aquí verificamos manualmente.
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token no proporcionado.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }

    try {
        const result = await query(
            `SELECT u.id, u.name, u.email, u.role,
            t.id AS tenant_id, t.name AS tenant_name,
            l.plan_type, l.status AS license_status, l.expires_at, l.key AS license_key
     FROM users u
     JOIN tenants t ON u.tenant_id = t.id
     LEFT JOIN licences l ON l.tenant_id = t.id
     WHERE u.id = $1
     ORDER BY l.created_at DESC
     LIMIT 1`,
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }

        const row = result.rows[0];
        res.json({
            user: {
                id: row.id,
                name: row.name,
                email: row.email,
                role: row.role,
            },
            tenant: {
                id: row.tenant_id,
                name: row.tenant_name,
            },
            license: row.plan_type ? {
                plan: row.plan_type,
                status: row.license_status,
                expiresAt: row.expires_at,
                key: row.license_key || null,
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

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    try {
        // 1. Buscar usuario por email (con datos del tenant)
        const result = await query(
            `SELECT u.id AS user_id, u.name AS user_name, u.email, u.password_hash, u.role,
                    t.id AS tenant_id, t.name AS tenant_name, t.email AS tenant_email
             FROM users u
             JOIN tenants t ON u.tenant_id = t.id
             WHERE u.email = $1
             LIMIT 1`,
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const row = result.rows[0];

        // 2. Comparar contraseña
        const isPasswordValid = await bcrypt.compare(password, row.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        // 3. Obtener licencia activa del tenant
        const licenceResult = await query(
            `SELECT plan_type, status, expires_at, key FROM licences 
     WHERE tenant_id = $1
     ORDER BY created_at DESC LIMIT 1`,
            [row.tenant_id]
        );

        const licence = licenceResult.rows[0] || null;
        const licence = licenceResult.rows[0] || null;

        // 4. Generar JWT
        const token = signToken({
            tenantId: row.tenant_id,
            userId: row.user_id,
            email: row.email,
            name: row.user_name,   // ← agregar
            role: row.role,
        });

        // 5. Responder
        res.json({
            token,
            user: {
                id: row.user_id,
                name: row.user_name,
                email: row.email,
                role: row.role
            },
            tenant: {
                id: row.tenant_id,
                name: row.tenant_name,
                email: row.tenant_email
            },
            license: licence ? {
                plan: licence.plan_type,
                status: licence.status,
                expiresAt: licence.expires_at,
                key: licence.key || null,
            } : null
        });

    } catch (err) {
        console.error('Error en login:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

export default router;
