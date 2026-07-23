import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/app-updates/latest — Última actualización activa (solo lectura)
// NOTA: no filtra por tenant_id — la versión del APK es global, no depende
// del tenant que hace login. El frontend compara este `version` contra su
// propia constante APP_VERSION y decide si mostrar el aviso.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/latest', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, version, apk_url, changelog, is_mandatory, created_at
             FROM app_updates
             WHERE is_active = true
             ORDER BY created_at DESC
             LIMIT 1`
        );

        if (result.rowCount === 0)
            return res.json({ update: null });

        return res.json({ update: result.rows[0] });

    } catch (error) {
        console.error('Error obteniendo última actualización:', error);
        return res.status(500).json({ error: 'Error al obtener la información de actualización.' });
    }
});

export default router;