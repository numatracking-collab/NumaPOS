import express from 'express';
import { pool } from '../config/db.js'; // ajusta al import real que uses en tus otros routers

const router = express.Router();

// GET /api/business
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM business_settings ORDER BY id LIMIT 1');
    if (rows.length === 0) {
      return res.json({
        business_name: '', logo_url: null, phone: '', email: '', address: '',
        ticket_config: {
          show_logo: true, show_business_name: true, show_phone: true,
          show_email: false, show_address: true, show_sku: true,
          show_discounts: true, show_cashier: true, show_caja: true,
        },
      });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[business] GET error:', err);
    res.status(500).json({ error: 'Error al obtener datos del negocio' });
  }
});

// PUT /api/business
router.put('/', async (req, res) => {
  const { business_name, logo_url, phone, email, address, ticket_config } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE business_settings SET
         business_name = COALESCE($1, business_name),
         logo_url      = COALESCE($2, logo_url),
         phone         = COALESCE($3, phone),
         email         = COALESCE($4, email),
         address       = COALESCE($5, address),
         ticket_config = COALESCE($6, ticket_config),
         updated_at    = now()
       WHERE id = (SELECT id FROM business_settings ORDER BY id LIMIT 1)
       RETURNING *`,
      [business_name, logo_url, phone, email, address, ticket_config ? JSON.stringify(ticket_config) : null]
    );
    if (rows.length === 0) {
      // no había fila (no debería pasar si corriste el INSERT inicial)
      const inserted = await pool.query(
        `INSERT INTO business_settings (business_name, logo_url, phone, email, address, ticket_config)
         VALUES ($1,$2,$3,$4,$5,COALESCE($6::jsonb, '{}'::jsonb)) RETURNING *`,
        [business_name, logo_url, phone, email, address, ticket_config ? JSON.stringify(ticket_config) : null]
      );
      return res.json(inserted.rows[0]);
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('[business] PUT error:', err);
    res.status(500).json({ error: 'Error al guardar datos del negocio' });
  }
});

export default router;