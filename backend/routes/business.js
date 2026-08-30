import express from 'express';
import { pool } from '../config/db.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();

const DEFAULT_BUSINESS = {
    business_name: '', logo_url: null, phone: '', email: '', address: '',
    ticket_config: {
        show_logo: true, show_business_name: true, show_phone: true,
        show_email: false, show_address: true, show_sku: true,
        show_discounts: true, show_cashier: true, show_caja: true,
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/business — Datos del negocio del tenant actual
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;

        const { rows } = await pool.query(
            `SELECT * FROM business_settings WHERE tenant_id = $1 LIMIT 1`,
            [tenant_id]
        );

        if (rows.length === 0) {
            return res.json(DEFAULT_BUSINESS);
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('[business] GET error:', err);
        res.status(500).json({ error: 'Error al obtener datos del negocio' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/business — Crear/actualizar datos del negocio del tenant actual
// Upsert atómico vía ON CONFLICT (tenant_id) para evitar condiciones de carrera
// entre el SELECT y el INSERT que tenía la versión anterior.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/', requirePermission('business.edit'), async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { business_name, logo_url, phone, email, address, ticket_config } = req.body;

        const ticketConfigJson = ticket_config ? JSON.stringify(ticket_config) : null;

        const { rows } = await pool.query(
            `INSERT INTO business_settings
                (tenant_id, business_name, logo_url, phone, email, address, ticket_config)
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::jsonb, '{}'::jsonb))
             ON CONFLICT (tenant_id) DO UPDATE SET
                business_name = COALESCE(EXCLUDED.business_name, business_settings.business_name),
                logo_url      = COALESCE(EXCLUDED.logo_url,      business_settings.logo_url),
                phone         = COALESCE(EXCLUDED.phone,         business_settings.phone),
                email         = COALESCE(EXCLUDED.email,         business_settings.email),
                address       = COALESCE(EXCLUDED.address,       business_settings.address),
                ticket_config = COALESCE($7::jsonb,               business_settings.ticket_config),
                updated_at    = now()
             RETURNING *`,
            [tenant_id, business_name, logo_url, phone, email, address, ticketConfigJson]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error('[business] PUT error:', err);
        res.status(500).json({ error: 'Error al guardar datos del negocio' });
    }
});

export default router;