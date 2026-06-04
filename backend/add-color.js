import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const run = async () => {
    try {
        await pool.query(`ALTER TABLE categories ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#0058be';`);
        console.log("Color column added to categories");
    } catch (err) {
        console.error("Error altering categories table", err);
    } finally {
        pool.end();
    }
};

run();
