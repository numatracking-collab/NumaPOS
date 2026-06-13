import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { verifyToken } from './middleware/authMiddleware.js';

import authRoutes          from './routes/auth.js';
import productRoutes       from './routes/products.js';
import categoryRoutes      from './routes/categories.js';
import inventoryRoutes     from './routes/inventory.js';
import uploadRouter        from './routes/upload.js';
import salesRoutes         from './routes/sales.js';
import cashRegistersRouter from './routes/cashRegisters.js';
import invoiceSeriesRouter from './routes/invoice-series.js';
import offersRouter        from './routes/offers.js';          // ← nuevo
import aiRouter from './routes/ai.js';
import adGenerateRouter from './routes/ad-generate.js';


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
// ── Rutas públicas ────────────────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/upload', uploadRouter);
app.use('/api/ai', adGenerateRouter);

// ── Rutas protegidas ──────────────────────────────────────────────────────────
app.use('/api/ai', aiRouter);
app.use('/api/products',       verifyToken, productRoutes);
app.use('/api/categories',     verifyToken, categoryRoutes);
app.use('/api/inventory',      verifyToken, inventoryRoutes);
app.use('/api/sales',          verifyToken, salesRoutes);
app.use('/api/cash-registers', verifyToken, cashRegistersRouter);
app.use('/api/invoice-series', verifyToken, invoiceSeriesRouter);
app.use('/api/offers',         verifyToken, offersRouter);     // ← nuevo

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`🚀 NUMA POS Backend corriendo en http://localhost:${PORT}`);
});