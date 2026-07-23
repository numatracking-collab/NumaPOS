import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const run = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`

            -- ── 1. Tabla app_updates ────────────────────────────────────────
            --    Global, NO lleva tenant_id: la versión del APK aplica a
            --    todos los tenants por igual (no es un dato de negocio).
            -- NOTA: published_by referencia admin_users, que vive en la BD
            -- del panel admin. Como comparten la misma BD, la FK es válida
            -- aunque esta tabla la consulte numa-pos-backend en modo lectura.
            CREATE TABLE IF NOT EXISTS app_updates (
                id            SERIAL PRIMARY KEY,
                version       VARCHAR(20)  NOT NULL,
                apk_url       TEXT         NOT NULL,
                changelog     TEXT,
                is_mandatory  BOOLEAN      NOT NULL DEFAULT false,
                is_active     BOOLEAN      NOT NULL DEFAULT true,
                published_by  INTEGER      REFERENCES admin_users(id) ON DELETE SET NULL,
                created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
            );

            -- ── 2. Evitar publicar la misma versión dos veces ────────────────
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_app_update_version
                ON app_updates (version);

            -- ── 3. La consulta más frecuente es "la última activa" ───────────
            CREATE INDEX IF NOT EXISTS idx_app_updates_active_created
                ON app_updates (is_active, created_at DESC);

        `);

        await client.query('COMMIT');
        console.log('✅  Migración app_updates completada.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌  ROLLBACK:', err.message);
    } finally {
        client.release();
        pool.end();
    }
};

run();