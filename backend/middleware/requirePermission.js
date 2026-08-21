/**
 * Middleware para proteger rutas por permiso operativo puntual
 * ('product.edit', 'caja.open', 'corte.create', etc).
 *
 * Debe usarse DESPUÉS de verifyToken, porque depende de req.user.permissions
 * (que verifyToken ya deja listo).
 *
 * Uso:
 *   router.put('/products/:id', verifyToken, requirePermission('product.edit'), handler);
 */
export const requirePermission = (code) => (req, res, next) => {
    if (!req.user?.permissions?.includes(code)) {
        return res.status(403).json({
            error: 'No tienes permiso para realizar esta acción.',
            code:  'FORBIDDEN',
            requiredPermission: code,
        });
    }
    next();
};