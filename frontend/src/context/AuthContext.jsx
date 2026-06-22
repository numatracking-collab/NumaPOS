import { createContext, useContext, useState, useEffect } from 'react';
import { authService, setLicenseBlockedHandler } from '../services/api';
import { reconnectBTPrinters, startBTWatcher } from '../services/printerService';
import LicenseExpiredModal from '../components/LicenseExpiredModal';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user,    setUser]    = useState(null);
    const [tenant,  setTenant]  = useState(null);
    const [license, setLicense] = useState(null);
    const [token,   setToken]   = useState(null);
    const [loading, setLoading] = useState(true);

    // ── Bloqueo por licencia vencida / cuenta cancelada ─────────────────
    // null cuando no hay bloqueo. { code, message } cuando sí lo hay.
    const [licenseBlock, setLicenseBlock] = useState(null);

    useEffect(() => {
        // api.js llama a este handler en cuanto CUALQUIER request protegido
        // regresa LICENSE_EXPIRED / ACCOUNT_CANCELLED / ACCOUNT_NOT_FOUND.
        setLicenseBlockedHandler((code, message) => {
            setLicenseBlock({ code, message });
        });

        // ── Watcher de reconexión BT (visibilitychange) ─────────────────
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
            reconnectBTPrinters();
        }
        setLoading(false);
    }, []);

    const saveSession = (data) => {
        setToken(data.token);
        setUser(data.user);
        setTenant(data.tenant);
        if (data.license) setLicense(data.license);
        setLicenseBlock(null); // sesión nueva: limpia cualquier bloqueo previo

        sessionStorage.setItem('numa_token', data.token);
        sessionStorage.setItem('numa_user',    JSON.stringify(data.user));
        sessionStorage.setItem('numa_tenant',  JSON.stringify(data.tenant));
        if (data.license) sessionStorage.setItem('numa_license', JSON.stringify(data.license));

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
        setLicenseBlock(null);
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

            {licenseBlock && (
                <LicenseExpiredModal
                    code={licenseBlock.code}
                    message={licenseBlock.message}
                    tenantName={tenant?.name}
                    onLogout={logout}
                />
            )}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth debe usarse dentro de un AuthProvider');
    return context;
}

export default AuthContext;