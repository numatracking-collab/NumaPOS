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

            -- ── 1. Columna is_active en cajas (si no existe) ─────────────────
            ALTER TABLE cajas
                ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

            -- ── 2. Columna tenant_id en cajas (si no existe) ──────────────────
            ALTER TABLE cajas
                ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

            -- ── 3. Reemplazar cash_registers con el esquema de cortes ──────────
            --    La tabla ya existe pero tiene columnas de "turno abierto".
            --    La dropeamos y recreamos limpia.
            --    (cash_movements también depende de ella, la dropeamos primero)
            DROP TABLE IF EXISTS cash_movements   CASCADE;
            DROP TABLE IF EXISTS cash_registers   CASCADE;

            CREATE TABLE cash_registers (
                id              SERIAL PRIMARY KEY,
                tenant_id       UUID          REFERENCES tenants(id) ON DELETE CASCADE,
                caja_id         INTEGER       REFERENCES cajas(id)   ON DELETE CASCADE,
                user_id         UUID          REFERENCES users(id)   ON DELETE SET NULL,
                folio_number    INTEGER       NOT NULL DEFAULT 1,
                total_cash      NUMERIC(10,2) NOT NULL DEFAULT 0,
                total_card      NUMERIC(10,2) NOT NULL DEFAULT 0,
                total_transfer  NUMERIC(10,2) NOT NULL DEFAULT 0,
                total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
                sales_from      TIMESTAMP,
                sales_to        TIMESTAMP,
                sales_count     INTEGER       NOT NULL DEFAULT 0,
                notes           TEXT,
                created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
            );

            CREATE UNIQUE INDEX uniq_corte_folio
                ON cash_registers (caja_id, folio_number);

            -- ── 4. Limpiar columna cash_register_id de sales ──────────────────
            --    Ya no la usamos (el modelo nuevo no tiene turnos abiertos)
            ALTER TABLE sales
                DROP COLUMN IF EXISTS cash_register_id;

            -- ── 5. Índice único de folio de venta (si no existe) ──────────────
            CREATE UNIQUE INDEX IF NOT EXISTS uniq_venta_folio
                ON sales (series_id, folio_number)
                WHERE series_id IS NOT NULL;

        `);

        await client.query('COMMIT');
        console.log('✅  Migración fix completada.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌  ROLLBACK:', err.message);
    } finally {
        client.release();
        pool.end();
    }
};

run();