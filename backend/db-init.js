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
        await pool.query(`
            -- 4. TABLA DE CATEGORÍAS (Para los filtros laterales del POS)
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- 5. TABLA DE PRODUCTOS
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                category_id INT REFERENCES categories(id) ON DELETE SET NULL,
                name VARCHAR(255) NOT NULL,
                sku VARCHAR(100), -- Código de barras
                price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                stock INT NOT NULL DEFAULT 0,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- 6. TABLA DE VENTAS (Cabecera del ticket)
            CREATE TABLE IF NOT EXISTS sales (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Quién vendió
                total_amount DECIMAL(10, 2) NOT NULL,
                tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
                payment_method VARCHAR(50) DEFAULT 'cash', -- 'cash', 'card', 'transfer'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- 7. DETALLE DE LA VENTA (La lista de productos por cada ticket)
            CREATE TABLE IF NOT EXISTS sale_items (
                id SERIAL PRIMARY KEY,
                sale_id INT REFERENCES sales(id) ON DELETE CASCADE,
                product_id INT REFERENCES products(id) ON DELETE SET NULL,
                quantity INT NOT NULL,
                unit_price DECIMAL(10, 2) NOT NULL,
                subtotal DECIMAL(10, 2) NOT NULL
            );

            -- 8. AJUSTES DE INVENTARIO (Pérdidas, robos, auditorías, entradas)
            CREATE TABLE IF NOT EXISTS inventory_adjustments (
                id SERIAL PRIMARY KEY,
                tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
                product_id INT REFERENCES products(id) ON DELETE CASCADE,
                user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Quién ajustó
                type VARCHAR(20) NOT NULL, -- 'IN' (Entrada) o 'OUT' (Salida)
                quantity INT NOT NULL,
                reason TEXT NOT NULL, -- 'auditoria', 'robo', 'merma', 'ingreso de mercancia'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Crear tabla de cajas
    CREATE TABLE cajas (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER, -- Relación con tu tabla de tenants
    name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar la caja por defecto (Asegúrate de poner el tenant_id correcto si aplica)
INSERT INTO cajas (name) VALUES ('Caja Principal');

-- Añadir la columna caja_id a la tabla de ventas
ALTER TABLE sales ADD COLUMN caja_id INTEGER REFERENCES cajas(id);
        `);
        console.log("Tablas creadas exitosamente");
    } catch (err) {
        console.error("Error creando tablas", err);
    } finally {
        pool.end();
    }
};

run();
