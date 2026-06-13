import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(verifyToken);

/* ─────────────────────────────────────────────────
   GET /api/products
   Devuelve productos + imágenes + claves adicionales
───────────────────────────────────────────────── */
router.get('/', async (req, res) => {
    const { tenantId } = req.user;

    try {
        const result = await query(
            `SELECT
                p.*,
                c.name  AS category_name,
                c.color AS category_color,

                -- Array de imágenes ordenado por sort_order
                COALESCE((
                    SELECT JSON_AGG(
                        jsonb_build_object('url', pi.image_url, 'sort_order', pi.sort_order)
                        ORDER BY pi.sort_order
                    )
                    FROM product_images pi
                    WHERE pi.product_id = p.id
                ), '[]') AS images,

                -- Array de claves adicionales
                COALESCE((
                    SELECT ARRAY_AGG(pk.key_value ORDER BY pk.id)
                    FROM product_keys pk
                    WHERE pk.product_id = p.id
                ), '{}') AS additional_keys

            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.tenant_id = $1
            ORDER BY p.id DESC`,
            [tenantId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).json({ error: 'Error al obtener los productos.' });
    }
});

/* ─────────────────────────────────────────────────
   POST /api/products
   Crea producto con imágenes y claves adicionales
───────────────────────────────────────────────── */
router.post('/', async (req, res) => {
    const { tenantId } = req.user;
    const {
        name, sku, category_id,
        price, stock, cost,
        minStock, maxStock,
        unit           = 'Pza',
        allowFractions = false,
        imageUrls      = [],
        additionalKeys = [],
    } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({ error: 'Nombre y precio son requeridos.' });
    }

    try {
        // 1 — Producto principal
        const { rows } = await query(
            `INSERT INTO products
                (tenant_id, category_id, name, sku, price, stock, cost,
                 min_stock, max_stock, image_url, unit, allow_fractions)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING *`,
            [
                tenantId,
                category_id    || null,
                name,
                sku            || null,
                price,
                stock          ?? 0,
                cost           || null,
                minStock       || null,
                maxStock       || null,
                imageUrls[0]   || null,   // primera imagen → image_url (retrocompatibilidad)
                unit,
                allowFractions,
            ]
        );
        const product = rows[0];

        // 2 — Imágenes
        for (let i = 0; i < imageUrls.length; i++) {
            await query(
                'INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1,$2,$3)',
                [product.id, imageUrls[i], i]
            );
        }

        // 3 — Claves adicionales
        for (const key of additionalKeys) {
            await query(
                'INSERT INTO product_keys (product_id, key_value) VALUES ($1,$2)',
                [product.id, key]
            );
        }

        res.status(201).json({
            ...product,
            images:          imageUrls.map((url, i) => ({ url, sort_order: i })),
            additional_keys: additionalKeys,
        });
    } catch (err) {
        console.error('Error creating product:', err);
        res.status(500).json({ error: 'Error al crear el producto.' });
    }
});

/* ─────────────────────────────────────────────────
   PUT /api/products/:id
   Actualiza producto; reemplaza imágenes y claves
───────────────────────────────────────────────── */
router.put('/:id', async (req, res) => {
    const { tenantId } = req.user;
    const { id } = req.params;
    const {
        name, sku, category_id,
        price, cost,
        minStock, maxStock,
        unit           = 'Pza',
        allowFractions = false,
        imageUrls      = [],
        additionalKeys = [],
    } = req.body;

    if (!name || price === undefined) {
        return res.status(400).json({ error: 'Nombre y precio son requeridos.' });
    }

    try {
        // 1 — Actualizar producto
        const { rows, rowCount } = await query(
            `UPDATE products
             SET category_id    = $1,
                 name           = $2,
                 sku            = $3,
                 price          = $4,
                 cost           = $5,
                 min_stock      = $6,
                 max_stock      = $7,
                 image_url      = $8,
                 unit           = $9,
                 allow_fractions = $10
             WHERE id = $11 AND tenant_id = $12
             RETURNING *`,
            [
                category_id    || null,
                name,
                sku            || null,
                price,
                cost           || null,
                minStock       || null,
                maxStock       || null,
                imageUrls[0]   || null,
                unit,
                allowFractions,
                id,
                tenantId,
            ]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }
        const product = rows[0];

        // 2 — Reemplazar imágenes (borrar + reinsertar)
        await query('DELETE FROM product_images WHERE product_id = $1', [id]);
        for (let i = 0; i < imageUrls.length; i++) {
            await query(
                'INSERT INTO product_images (product_id, image_url, sort_order) VALUES ($1,$2,$3)',
                [id, imageUrls[i], i]
            );
        }

        // 3 — Reemplazar claves adicionales
        await query('DELETE FROM product_keys WHERE product_id = $1', [id]);
        for (const key of additionalKeys) {
            await query(
                'INSERT INTO product_keys (product_id, key_value) VALUES ($1,$2)',
                [id, key]
            );
        }

        res.json({
            ...product,
            images:          imageUrls.map((url, i) => ({ url, sort_order: i })),
            additional_keys: additionalKeys,
        });
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ error: 'Error al actualizar el producto.' });
    }
});

/* ─────────────────────────────────────────────────
   DELETE /api/products/:id
───────────────────────────────────────────────── */
router.delete('/:id', async (req, res) => {
    const { tenantId } = req.user;
    const { id } = req.params;

    try {
        const { rows, rowCount } = await query(
            'DELETE FROM products WHERE id = $1 AND tenant_id = $2 RETURNING *',
            [id, tenantId]
        );
        if (rowCount === 0) return res.status(404).json({ error: 'Producto no encontrado.' });
        res.json({ message: 'Producto eliminado', product: rows[0] });
    } catch (err) {
        console.error('Error deleting product:', err);
        res.status(500).json({ error: 'Error al eliminar el producto.' });
    }
});

export default router;