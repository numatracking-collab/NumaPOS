import express from 'express';
import { pool } from '../config/db.js';

const router = express.Router();

const normalizeVersion = (v) => String(v ?? '').trim().replace(/^v/i, '');

const isNewerVersion = (remote, local) => {
    const r = normalizeVersion(remote).split('.').map(n => parseInt(n, 10) || 0);
    const l = normalizeVersion(local).split('.').map(n => parseInt(n, 10) || 0);
    const len = Math.max(r.length, l.length);
    for (let i = 0; i < len; i++) {
        const diff = (r[i] || 0) - (l[i] || 0);
        if (diff > 0) return true;
        if (diff < 0) return false;
    }
    return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/app-updates/latest[?current=1.6.4]
// - Global (no filtra por tenant).
// - Si viene `current`, solo devuelve `update` cuando la versión publicada es
//   estrictamente mayor. Sin `current`, responde como antes (compatibilidad con
//   APKs ya instalados que comparan en el cliente).
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

        const latest = result.rows[0];
        const current = req.query.current;

        if (current && !isNewerVersion(latest.version, current))
            return res.json({ update: null });

        return res.json({ update: latest });

    } catch (error) {
        console.error('Error obteniendo última actualización:', error);
        return res.status(500).json({ error: 'Error al obtener la información de actualización.' });
    }
});

export default router;