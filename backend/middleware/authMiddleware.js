import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';

dotenv.config();

/**
 * Middleware de autenticación JWT.
 * 1. Verifica el token enviado en el header Authorization.
 * 2. Inyecta req.user con { tenantId, userId, email, role }.
 * 3. Valida que la licencia del tenant esté vigente y que el tenant
 *    no esté cancelado. Se revisa en CADA request (bloqueo instantáneo,
 *    no solo al iniciar sesión) — así si la licencia vence mientras el
 *    cajero ya tiene sesión abierta, se corta el acceso de inmediato.
 *
 * Si la licencia no es válida, responde 403 con un `code` específico
 * (LICENSE_EXPIRED | ACCOUNT_CANCELLED | ACCOUNT_NOT_FOUND) para que el
 * frontend sepa mostrar el modal de renovación en vez de un error genérico.
 */
export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        return res.status(403).json({ error: 'Token inválido o expirado.' });
    }

    req.user = {
        tenantId: decoded.tenantId,
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
    };

    // ── Validación de licencia ──────────────────────────────────────────
    try {
        const result = await pool.query(
            `SELECT t.status   AS tenant_status,
                    l.status   AS licence_status,
                    l.expires_at
             FROM tenants t
             LEFT JOIN licences l ON l.tenant_id = t.id
             WHERE t.id = $1
             ORDER BY l.created_at DESC
             LIMIT 1`,
            [decoded.tenantId]
        );

        const row = result.rows[0];

        if (!row) {
            return res.status(403).json({
                error: 'No se encontró información de tu cuenta.',
                code: 'ACCOUNT_NOT_FOUND',
            });
        }

        if (row.tenant_status === 'cancelado') {
            return res.status(403).json({
                error: 'Tu cuenta ha sido cancelada. Contáctanos para reactivarla.',
                code: 'ACCOUNT_CANCELLED',
            });
        }

        const isLicenceCancelled = row.licence_status === 'cancelled';
        const isLicenceExpired   = !row.expires_at || new Date(row.expires_at) < new Date();

        if (isLicenceCancelled || isLicenceExpired) {
            return res.status(403).json({
                error: 'Tu licencia ha vencido. Renueva tu plan para seguir usando NUMA POS.',
                code: 'LICENSE_EXPIRED',
            });
        }

        next();

    } catch (err) {
        console.error('Error validando licencia:', err);
        return res.status(500).json({ error: 'Error interno al validar tu cuenta.' });
    }
};