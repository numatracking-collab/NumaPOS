import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Devuelve las ofertas con sus productos embebidos */
async function fetchOffersWithProducts(client, tenant_id, extraWhere = '', extraParams = []) {
    const params = [tenant_id, ...extraParams];

    const result = await client.query(
        `SELECT
            o.*,
            COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id',        p.id,
                        'name',      p.name,
                        'sku',       p.sku,
                        'price',     p.price,
                        'stock',     p.stock,
                        'image_url', p.image_url
                    )
                ) FILTER (WHERE p.id IS NOT NULL),
                '[]'
            ) AS products
         FROM offers o
         LEFT JOIN offer_products op ON op.offer_id = o.id
         LEFT JOIN products p        ON p.id = op.product_id
         WHERE o.tenant_id = $1 ${extraWhere}
         GROUP BY o.id
         ORDER BY o.created_at DESC`,
        params
    );

    return result.rows.map(row => ({
        ...row,
        products:    typeof row.products === 'string' ? JSON.parse(row.products) : row.products,
        active_days: row.active_days ?? [],
    }));
}

/** Valida y normaliza el body de creación/actualización */
function parseOfferBody(body) {
    const {
        name,
        type,
        discount_pct  = null,
        buy_qty       = null,
        get_qty       = null,
        date_start    = null,
        date_end      = null,
        time_start    = null,
        time_end      = null,
        active_days   = [0,1,2,3,4,5,6],
        status        = 'active',
        product_ids   = [],
    } = body;

    const errors = [];

    if (!name?.trim())                errors.push('El nombre de la oferta es requerido.');
    if (!['2x1','3x2','nxm','mitad','descuento'].includes(type))
        errors.push('Tipo de oferta inválido.');
    if (type === 'descuento' && (discount_pct == null || discount_pct < 1 || discount_pct > 100))
        errors.push('El porcentaje de descuento debe estar entre 1 y 100.');
    if (type === 'nxm' && (!buy_qty || !get_qty || buy_qty < 1 || get_qty < 1))
        errors.push('Para tipo nxm debes indicar buy_qty y get_qty mayores a 0.');
    if (!Array.isArray(active_days) || active_days.length === 0)
        errors.push('Debes seleccionar al menos un día activo.');
    if (!Array.isArray(product_ids) || product_ids.length === 0)
        errors.push('Debes seleccionar al menos un producto.');

    return {
        errors,
        data: {
            name:         name?.trim(),
            type,
            discount_pct: type === 'descuento' ? Number(discount_pct) : null,
            buy_qty:      type === 'nxm'        ? Number(buy_qty)      : null,
            get_qty:      type === 'nxm'        ? Number(get_qty)      : null,
            date_start:   date_start  || null,
            date_end:     date_end    || null,
            time_start:   time_start  || null,
            time_end:     time_end    || null,
            active_days,
            status:       ['active','paused','expired'].includes(status) ? status : 'active',
            product_ids:  product_ids.map(Number),
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/offers — Listar ofertas del tenant
// Query params: status (active|paused|expired), product_id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id } = req.user;
        const extraParams = [];
        let extraWhere = '';

        if (req.query.status) {
            extraParams.push(req.query.status);
            extraWhere += ` AND o.status = $${extraParams.length + 1}`;
        }
        if (req.query.product_id) {
            extraParams.push(Number(req.query.product_id));
            extraWhere += ` AND EXISTS (
                SELECT 1 FROM offer_products xop
                WHERE xop.offer_id = o.id AND xop.product_id = $${extraParams.length + 1}
            )`;
        }

        const offers = await fetchOffersWithProducts(client, tenant_id, extraWhere, extraParams);
        return res.json(offers);
    } catch (err) {
        console.error('Error listando ofertas:', err);
        return res.status(500).json({ error: 'Error al obtener las ofertas.' });
    } finally {
        client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/offers/:id — Detalle de una oferta
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id } = req.user;
        const { id } = req.params;

        const offers = await fetchOffersWithProducts(
            client, tenant_id,
            'AND o.id = $2', [Number(id)]
        );

        if (offers.length === 0)
            return res.status(404).json({ error: 'Oferta no encontrada.' });

        return res.json(offers[0]);
    } catch (err) {
        console.error('Error obteniendo oferta:', err);
        return res.status(500).json({ error: 'Error al obtener la oferta.' });
    } finally {
        client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/offers — Crear oferta
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id, userId: user_id } = req.user;
        const { errors, data } = parseOfferBody(req.body);

        if (errors.length > 0)
            return res.status(400).json({ error: errors.join(' ') });

        await client.query('BEGIN');

        // ── 1. Insertar oferta ────────────────────────────────────────────────
        const offerResult = await client.query(
            `INSERT INTO offers
                (tenant_id, name, type,
                 discount_pct, buy_qty, get_qty,
                 date_start, date_end, time_start, time_end,
                 active_days, status, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [
                tenant_id, data.name, data.type,
                data.discount_pct, data.buy_qty, data.get_qty,
                data.date_start, data.date_end, data.time_start, data.time_end,
                data.active_days, data.status, user_id,
            ]
        );
        const offer = offerResult.rows[0];

        // ── 2. Insertar productos ─────────────────────────────────────────────
        for (const product_id of data.product_ids) {
            await client.query(
                `INSERT INTO offer_products (offer_id, product_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [offer.id, product_id]
            );
        }

        await client.query('COMMIT');

        // ── 3. Devolver la oferta completa con productos embebidos ────────────
        const full = await fetchOffersWithProducts(
            client, tenant_id, 'AND o.id = $2', [offer.id]
        );

        return res.status(201).json({
            message: 'Oferta creada correctamente.',
            offer:   full[0],
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creando oferta:', err);
        return res.status(500).json({ error: 'Error al crear la oferta.' });
    } finally {
        client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/offers/:id — Editar oferta completa
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const { tenantId: tenant_id } = req.user;
        const { id } = req.params;
        const { errors, data } = parseOfferBody(req.body);

        if (errors.length > 0)
            return res.status(400).json({ error: errors.join(' ') });

        await client.query('BEGIN');

        // ── Verificar que la oferta pertenece al tenant ───────────────────────
        const check = await client.query(
            `SELECT id FROM offers WHERE id = $1 AND tenant_id = $2`,
            [id, tenant_id]
        );
        if (check.rowCount === 0)
            return res.status(404).json({ error: 'Oferta no encontrada.' });

        // ── Actualizar cabecera ───────────────────────────────────────────────
        await client.query(
            `UPDATE offers SET
                name = $1, type = $2,
                discount_pct = $3, buy_qty = $4, get_qty = $5,
                date_start = $6, date_end = $7,
                time_start = $8, time_end = $9,
                active_days = $10, status = $11
             WHERE id = $12`,
            [
                data.name, data.type,
                data.discount_pct, data.buy_qty, data.get_qty,
                data.date_start, data.date_end,
                data.time_start, data.time_end,
                data.active_days, data.status,
                id,
            ]
        );

        // ── Reemplazar productos: borrar los viejos e insertar los nuevos ─────
        await client.query(`DELETE FROM offer_products WHERE offer_id = $1`, [id]);
        for (const product_id of data.product_ids) {
            await client.query(
                `INSERT INTO offer_products (offer_id, product_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [id, product_id]
            );
        }

        await client.query('COMMIT');

        const full = await fetchOffersWithProducts(
            client, tenant_id, 'AND o.id = $2', [Number(id)]
        );
        return res.json({ message: 'Oferta actualizada.', offer: full[0] });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error actualizando oferta:', err);
        return res.status(500).json({ error: 'Error al actualizar la oferta.' });
    } finally {
        client.release();
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/offers/:id/status — Cambiar solo el status (active/paused/expired)
// Body: { status: 'active' | 'paused' | 'expired' }
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { id } = req.params;
        const { status } = req.body;

        if (!['active','paused','expired'].includes(status))
            return res.status(400).json({ error: 'Status inválido.' });

        const result = await pool.query(
            `UPDATE offers SET status = $1
             WHERE id = $2 AND tenant_id = $3
             RETURNING id, status`,
            [status, id, tenant_id]
        );

        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Oferta no encontrada.' });

        return res.json({ message: 'Estado actualizado.', ...result.rows[0] });
    } catch (err) {
        console.error('Error cambiando status:', err);
        return res.status(500).json({ error: 'Error al cambiar el estado.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/offers/:id — Eliminar oferta (y sus offer_products en cascada)
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const { tenantId: tenant_id } = req.user;
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM offers WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [id, tenant_id]
        );

        if (result.rowCount === 0)
            return res.status(404).json({ error: 'Oferta no encontrada.' });

        return res.json({ message: 'Oferta eliminada.' });
    } catch (err) {
        console.error('Error eliminando oferta:', err);
        return res.status(500).json({ error: 'Error al eliminar la oferta.' });
    }
});

export default router;