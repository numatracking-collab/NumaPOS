import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const { login, isAuthenticated } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Si ya está autenticado, redirigir al POS
    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Por favor completa todos los campos.');
            return;
        }

        if (!email.includes('@')) {
            setError('Ingresa un email válido.');
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
        } catch (err) {
            setError(err.message || 'Error al iniciar sesión.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background overflow-hidden relative">
            {/* Decorative background shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[160px] -right-[160px] w-[500px] h-[500px] rounded-full bg-secondary/5" />
                <div className="absolute -bottom-[240px] -left-[160px] w-[600px] h-[600px] rounded-full bg-surface-container-high/60" />
                <div className="absolute top-1/4 left-1/4 w-[200px] h-[200px] rounded-full bg-secondary/3" />
            </div>

            <div className="relative z-10 w-full max-w-[448px] mx-md">
                {/* Card principal */}
                <div className="bg-surface-container-lowest rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-outline-variant/30 overflow-hidden">
                    
                    {/* Header con branding */}
                    <div className="bg-primary-container px-xl py-xl text-center">
                        <div className="inline-flex items-center justify-center w-[64px] h-[64px] bg-secondary rounded-[16px] mb-md shadow-lg">
                            <span className="material-symbols-outlined text-on-secondary text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                point_of_sale
                            </span>
                        </div>
                        <h1 className="text-[24px] font-bold text-on-primary tracking-tight">NUMA POS</h1>
                        <p className="text-on-primary-container text-[14px] mt-base">Sistema de Punto de Venta</p>
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleSubmit} className="px-xl py-xl flex flex-col gap-[20px]">
                        <div>
                            <h2 className="text-[20px] font-semibold text-on-surface mb-base">Iniciar Sesión</h2>
                            <p className="text-on-surface-variant text-[14px]">Ingresa tus credenciales para acceder</p>
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="flex items-center gap-sm px-md py-[12px] bg-error-container rounded-[12px] text-on-error-container text-[14px] animate-[slideDown_0.2s_ease-out]">
                                <span className="material-symbols-outlined text-[18px]">error</span>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Email */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="login-email" className="text-[14px] font-medium text-on-surface">
                                Correo electrónico
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                                <input
                                    id="login-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    className="w-full pl-touch-target pr-md py-[12px] bg-surface-container-low border border-outline-variant rounded-[12px] text-on-surface text-[14px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="login-password" className="text-[14px] font-medium text-on-surface">
                                Contraseña
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                                <input
                                    id="login-password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-touch-target pr-[48px] py-[12px] bg-surface-container-low border border-outline-variant rounded-[12px] text-on-surface text-[14px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-[12px] top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                                    tabIndex={-1}
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            id="login-submit-btn"
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-[14px] bg-secondary text-on-secondary font-semibold text-[14px] rounded-[12px] hover:bg-secondary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-sm shadow-md hover:shadow-lg"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-[20px] h-[20px] border-2 border-on-secondary border-t-transparent rounded-full animate-spin" />
                                    <span>Ingresando...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[18px]">login</span>
                                    <span>Iniciar Sesión</span>
                                </>
                            )}
                        </button>

                        {/* Link to register */}
                        <p className="text-center text-[14px] text-on-surface-variant pt-sm">
                            ¿No tienes una cuenta?{' '}
                            <Link
                                to="/signup"
                                className="text-secondary font-semibold hover:underline transition-colors"
                            >
                                Regístrate aquí
                            </Link>
                        </p>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-[12px] text-outline mt-lg">
                    © 2026 NUMA POS — Powered by NUMA
                </p>
            </div>
        </div>
    );
}
