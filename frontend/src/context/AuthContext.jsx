import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext(null);

/**
 * AuthProvider — Maneja el estado global de autenticación.
 * Persiste la sesión en localStorage y restaura al recargar.
 */
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [tenant, setTenant] = useState(null);
    const [license, setLicense] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    // Restaurar sesión al montar
    useEffect(() => {
        const savedToken = sessionStorage.getItem('numa_token');
        const savedUser = sessionStorage.getItem('numa_user');
        const savedTenant = sessionStorage.getItem('numa_tenant');
        const savedLicense = sessionStorage.getItem('numa_license');

        if (savedToken && savedUser && savedTenant) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            setTenant(JSON.parse(savedTenant));
            if (savedLicense) setLicense(JSON.parse(savedLicense));
        }
        setLoading(false);
    }, []);

    /**
     * Guarda los datos de sesión en estado y localStorage
     */
    const saveSession = (data) => {
        setToken(data.token);
        setUser(data.user);
        setTenant(data.tenant);
        if (data.license) setLicense(data.license);

        sessionStorage.setItem('numa_token', data.token);
        sessionStorage.setItem('numa_user', JSON.stringify(data.user));
        sessionStorage.setItem('numa_tenant', JSON.stringify(data.tenant));
        if (data.license) sessionStorage.setItem('numa_license', JSON.stringify(data.license));
    };

    /**
     * Registro — Crea tenant + licencia + usuario admin
     */
    const register = async (formData) => {
        const data = await authService.register(formData);
        saveSession(data);
        return data;
    };

    /**
     * Login — Autentica con email y contraseña
     */
    const login = async (email, password) => {
        const data = await authService.login({ email, password });
        saveSession(data);
        return data;
    };

    /**
     * Logout — Limpia todo el estado y localStorage
     */
    const logout = () => {
        setToken(null);
        setUser(null);
        setTenant(null);
        setLicense(null);
        sessionStorage.removeItem('numa_token');
        sessionStorage.removeItem('numa_user');
        sessionStorage.removeItem('numa_tenant');
        sessionStorage.removeItem('numa_license');
    };

    const value = {
        user,
        tenant,
        license,
        token,
        loading,
        isAuthenticated: !!token,
        register,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook personalizado para acceder al contexto de autenticación.
 */
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return context;
}

export default AuthContext;
