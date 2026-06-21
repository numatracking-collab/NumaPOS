import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';
import { reconnectBTPrinters, startBTWatcher } from '../services/printerService'; // ← startBTWatcher es NUEVO

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user,    setUser]    = useState(null);
    const [tenant,  setTenant]  = useState(null);
    const [license, setLicense] = useState(null);
    const [token,   setToken]   = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // ── NUEVO: activa el watcher de reconexión BT (visibilitychange) ──
        // Se hace fuera del bloque de sesión a propósito: cubre el caso de
        // que la conexión GATT se caiga en background mientras la sesión
        // sigue activa (sessionStorage no se borró, pero el navegador sí
        // tiró la conexión). startBTWatcher() es idempotente, así que no
        // hay riesgo de engancharlo dos veces.
        startBTWatcher();

        const savedToken   = sessionStorage.getItem('numa_token');
        const savedUser    = sessionStorage.getItem('numa_user');
        const savedTenant  = sessionStorage.getItem('numa_tenant');
        const savedLicense = sessionStorage.getItem('numa_license');

        if (savedToken && savedUser && savedTenant) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            setTenant(JSON.parse(savedTenant));
            if (savedLicense) setLicense(JSON.parse(savedLicense));
            // Si ya había sesión activa (recarga de página), reconectar también
            reconnectBTPrinters();
        }
        setLoading(false);
    }, []);

    const saveSession = (data) => {
        setToken(data.token);
        setUser(data.user);
        setTenant(data.tenant);
        if (data.license) setLicense(data.license);

        sessionStorage.setItem('numa_token', data.token);
        sessionStorage.setItem('numa_user',    JSON.stringify(data.user));
        sessionStorage.setItem('numa_tenant',  JSON.stringify(data.tenant));
        if (data.license) sessionStorage.setItem('numa_license', JSON.stringify(data.license));

        // Reconectar impresora BT tras login o registro
        reconnectBTPrinters();
    };

    const register = async (formData) => {
        const data = await authService.register(formData);
        saveSession(data);
        return data;
    };

    const login = async (email, password) => {
        const data = await authService.login({ email, password });
        saveSession(data);
        return data;
    };

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
        user, tenant, license, token, loading,
        isAuthenticated: !!token,
        register, login, logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
    return context;
}

export default AuthContext;