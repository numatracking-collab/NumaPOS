import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configura Cloudinary con variables de entorno
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,   // dtq9fjj12
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer: memoria (no escribe en disco)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },           // 5 MB por imagen
    fileFilter: (_, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Solo se permiten imágenes.'));
    },
});

router.use(verifyToken);

/**
 * POST /api/upload
 * Body: multipart/form-data  →  campo "images" (1-10 archivos)
 * Respuesta: { urls: ['https://res.cloudinary.com/...', ...] }
 */
router.post('/', upload.array('images', 10), async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No se recibieron archivos.' });
    }

    try {
        const uploadToCloud = (fileBuffer) =>
            new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    {
                        folder: `pos/products/${req.user.tenantId}`,
                        transformation: [
                            { width: 900, height: 900, crop: 'limit', quality: 'auto:good', fetch_format: 'auto' }
                        ],
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result.secure_url);
                    }
                );
                stream.end(fileBuffer);
            });

        const urls = await Promise.all(req.files.map(f => uploadToCloud(f.buffer)));
        res.json({ urls });
    } catch (err) {
        console.error('Error al subir a Cloudinary:', err);
        res.status(500).json({ error: 'Error al subir las imágenes.' });
    }
});

export default router;