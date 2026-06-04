import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute — Wrapper que protege rutas privadas.
 * Si no hay sesión activa, redirige a /login.
 * Muestra un loader mientras se restaura la sesión.
 */
export default function ProtectedRoute() {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
                    <span className="text-on-surface-variant text-sm font-medium">Cargando...</span>
                </div>
            </div>
        );
    }

    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
