import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { pool } from '../config/db.js';

dotenv.config();

/*
 * Códigos de bloqueo:
 *   LICENSE_EXPIRED    → vencida por fecha          → "contacta a ventas"
 *   LICENSE_SUSPENDED  → suspendida manualmente      → "contacta a soporte"
 *   LICENSE_CANCELLED  → cancelada manualmente       → "contacta a soporte"
 *   ACCOUNT_CANCELLED  → tenant.status = cancelado   → "contacta a soporte"
 *   ACCOUNT_NOT_FOUND  → tenant no existe en la DB   → genérico
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
        userId:   decoded.userId,
        email:    decoded.email,
        role:     decoded.role,
    };

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
                code:  'ACCOUNT_NOT_FOUND',
            });
        }

        // ── Tenant cancelado a nivel de cuenta ───────────────────────────
        if (row.tenant_status === 'cancelado') {
            return res.status(403).json({
                error: 'Tu cuenta ha sido cancelada. Contacta a soporte para reactivarla.',
                code:  'ACCOUNT_CANCELLED',
            });
        }

        // ── Licencia suspendida ───────────────────────────────────────────
        if (row.licence_status === 'suspended') {
            return res.status(403).json({
                error: 'Tu licencia está suspendida. Contacta a soporte para resolverlo.',
                code:  'LICENSE_SUSPENDED',
            });
        }

        // ── Licencia cancelada manualmente ────────────────────────────────
        if (row.licence_status === 'cancelled') {
            return res.status(403).json({
                error: 'Tu licencia ha sido cancelada. Contacta a soporte para reactivarla.',
                code:  'LICENSE_CANCELLED',
            });
        }

        // ── Licencia vencida por fecha ────────────────────────────────────
        const isExpired = !row.expires_at || new Date(row.expires_at) < new Date();
        if (isExpired) {
            return res.status(403).json({
                error: 'Tu licencia ha vencido. Contacta a ventas para renovar tu plan.',
                code:  'LICENSE_EXPIRED',
            });
        }

        next();

    } catch (err) {
        console.error('Error validando licencia:', err);
        return res.status(500).json({ error: 'Error interno al validar tu cuenta.' });
    }
};