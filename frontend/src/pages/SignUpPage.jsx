import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SignUpPage() {
    const { register, isAuthenticated } = useAuth();

    const [formData, setFormData] = useState({
        businessName: '',
        ownerName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [licenseInfo, setLicenseInfo] = useState(null);

    // Si ya está autenticado y no hay licencia pendiente de mostrar, redirigir
    if (isAuthenticated && !licenseInfo) {
        return <Navigate to="/" replace />;
    }

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const { businessName, ownerName, email, phone, password, confirmPassword } = formData;

        // Validaciones client-side
        if (!businessName || !ownerName || !email || !password || !confirmPassword) {
            setError('Por favor completa todos los campos obligatorios.');
            return;
        }

        if (!email.includes('@')) {
            setError('Ingresa un correo electrónico válido.');
            return;
        }

        if (phone && (phone.length < 10 || !/^\d+$/.test(phone))) {
            setError('El teléfono debe contener al menos 10 dígitos numéricos.');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setIsLoading(true);
        try {
            const data = await register({ businessName, ownerName, email, phone, password });
            setLicenseInfo(data.license);
        } catch (err) {
            setError(err.message || 'Error al crear la cuenta.');
        } finally {
            setIsLoading(false);
        }
    };

    // ── Pantalla de licencia generada ──
    if (licenseInfo) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background overflow-hidden relative">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-[160px] -right-[160px] w-[500px] h-[500px] rounded-full bg-secondary/5" />
                    <div className="absolute -bottom-[240px] -left-[160px] w-[600px] h-[600px] rounded-full bg-surface-container-high/60" />
                </div>

                <div className="relative z-10 w-full max-w-[448px] mx-md">
                    <div className="bg-surface-container-lowest rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-outline-variant/30 overflow-hidden">
                        <div className="bg-primary-container px-xl py-xl text-center">
                            <div className="inline-flex items-center justify-center w-[64px] h-[64px] bg-secondary rounded-[16px] mb-md shadow-lg">
                                <span className="material-symbols-outlined text-on-secondary text-[30px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    verified
                                </span>
                            </div>
                            <h1 className="text-[24px] font-bold text-on-primary">¡Cuenta Creada!</h1>
                            <p className="text-on-primary-container text-[14px] mt-base">Tu negocio ha sido registrado exitosamente</p>
                        </div>

                        <div className="px-xl py-xl flex flex-col gap-[24px]">
                            <div className="bg-surface-container-low border border-outline-variant/50 rounded-[12px] p-[20px] text-center flex flex-col gap-[12px]">
                                <p className="text-[12px] font-semibold text-on-surface-variant uppercase tracking-wider">Tu Licencia</p>
                                <p className="text-[24px] font-bold text-secondary tracking-widest font-mono">
                                    {licenseInfo.key}
                                </p>
                                <div className="flex items-center justify-center gap-md text-[12px] text-on-surface-variant">
                                    <span className="flex items-center gap-[4px]">
                                        <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                                        Plan: {licenseInfo.plan}
                                    </span>
                                    <span className="flex items-center gap-[4px]">
                                        <span className="material-symbols-outlined text-[14px]">schedule</span>
                                        7 días de prueba
                                    </span>
                                </div>
                            </div>

                            <Link
                                to="/"
                                className="w-full py-[14px] bg-secondary text-on-secondary font-semibold text-[14px] rounded-[12px] hover:bg-secondary/90 active:scale-[0.98] transition-all flex items-center justify-center gap-sm shadow-md hover:shadow-lg"
                            >
                                <span className="material-symbols-outlined text-[18px]">point_of_sale</span>
                                <span>Ir al Punto de Venta</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Formulario de registro ──
    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background overflow-hidden relative">
            {/* Decorative background shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[160px] -left-[160px] w-[500px] h-[500px] rounded-full bg-secondary/5" />
                <div className="absolute -bottom-[240px] -right-[160px] w-[600px] h-[600px] rounded-full bg-surface-container-high/60" />
                <div className="absolute bottom-1/4 right-1/4 w-[200px] h-[200px] rounded-full bg-secondary/3" />
            </div>

            <div className="relative z-10 w-full max-w-[448px] mx-md">
                {/* Card principal */}
                <div className="bg-surface-container-lowest rounded-[16px] shadow-[0_8px_40px_rgba(0,0,0,0.08)] border border-outline-variant/30 overflow-hidden max-h-[92vh] overflow-y-auto custom-scrollbar">
                    
                    {/* Header con branding */}
                    <div className="bg-primary-container px-xl py-[24px] text-center sticky top-0 z-10">
                        <div className="inline-flex items-center justify-center w-[56px] h-[56px] bg-secondary rounded-[16px] mb-[12px] shadow-lg">
                            <span className="material-symbols-outlined text-on-secondary text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                                storefront
                            </span>
                        </div>
                        <h1 className="text-[20px] font-bold text-on-primary tracking-tight">Registra tu Negocio</h1>
                        <p className="text-on-primary-container text-[14px] mt-[2px]">Crea una cuenta y empieza a vender</p>
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleSubmit} className="px-xl py-[24px] flex flex-col gap-[16px]">

                        {/* Error message */}
                        {error && (
                            <div className="flex items-center gap-sm px-md py-[12px] bg-error-container rounded-[12px] text-on-error-container text-[14px] animate-[slideDown_0.2s_ease-out]">
                                <span className="material-symbols-outlined text-[18px] shrink-0">error</span>
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Business Name */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="signup-business" className="text-[14px] font-medium text-on-surface">
                                Nombre del Negocio <span className="text-error">*</span>
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-outline text-[20px]">store</span>
                                <input
                                    id="signup-business"
                                    name="businessName"
                                    type="text"
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    placeholder="Mi Tienda"
                                    className="w-full pl-[44px] pr-md py-[12px] bg-surface-container-low border border-outline-variant rounded-[12px] text-on-surface text-[14px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Owner Name */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="signup-owner" className="text-[14px] font-medium text-on-surface">
                                Nombre del Propietario <span className="text-error">*</span>
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-outline text-[20px]">person</span>
                                <input
                                    id="signup-owner"
                                    name="ownerName"
                                    type="text"
                                    value={formData.ownerName}
                                    onChange={handleChange}
                                    placeholder="Juan Pérez"
                                    className="w-full pl-[44px] pr-md py-[12px] bg-surface-container-low border border-outline-variant rounded-[12px] text-on-surface text-[14px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="signup-email" className="text-[14px] font-medium text-on-surface">
                                Correo Electrónico <span className="text-error">*</span>
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-outline text-[20px]">mail</span>
                                <input
                                    id="signup-email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="tu@email.com"
                                    className="w-full pl-[44px] pr-md py-[12px] bg-surface-container-low border border-outline-variant rounded-[12px] text-on-surface text-[14px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        {/* Phone */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="signup-phone" className="text-[14px] font-medium text-on-surface">
                                Teléfono
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-outline text-[20px]">phone</span>
                                <input
                                    id="signup-phone"
                                    name="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="5512345678"
                                    className="w-full pl-[44px] pr-md py-[12px] bg-surface-container-low border border-outline-variant rounded-[12px] text-on-surface text-[14px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="signup-password" className="text-[14px] font-medium text-on-surface">
                                Contraseña <span className="text-error">*</span>
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
                                <input
                                    id="signup-password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder="Mínimo 6 caracteres"
                                    className="w-full pl-[44px] pr-[48px] py-[12px] bg-surface-container-low border border-outline-variant rounded-[12px] text-on-surface text-[14px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                                    autoComplete="new-password"
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

                        {/* Confirm Password */}
                        <div className="flex flex-col gap-[6px]">
                            <label htmlFor="signup-confirm" className="text-[14px] font-medium text-on-surface">
                                Confirmar Contraseña <span className="text-error">*</span>
                            </label>
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-[12px] top-1/2 -translate-y-1/2 text-outline text-[20px]">lock_reset</span>
                                <input
                                    id="signup-confirm"
                                    name="confirmPassword"
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Repite tu contraseña"
                                    className="w-full pl-[44px] pr-md py-[12px] bg-surface-container-low border border-outline-variant rounded-[12px] text-on-surface text-[14px] placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        {/* Submit button */}
                        <button
                            id="signup-submit-btn"
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-[14px] bg-secondary text-on-secondary font-semibold text-[14px] rounded-[12px] hover:bg-secondary/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-[8px] shadow-md hover:shadow-lg mt-[8px]"
                        >
                            {isLoading ? (
                                <>
                                    <div className="w-[20px] h-[20px] border-2 border-on-secondary border-t-transparent rounded-full animate-spin" />
                                    <span>Creando cuenta...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[18px]">how_to_reg</span>
                                    <span>Crear Cuenta</span>
                                </>
                            )}
                        </button>

                        {/* Link to login */}
                        <p className="text-center text-[14px] text-on-surface-variant pb-[8px]">
                            ¿Ya tienes una cuenta?{' '}
                            <Link
                                to="/login"
                                className="text-secondary font-semibold hover:underline transition-colors"
                            >
                                Inicia sesión
                            </Link>
                        </p>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-[12px] text-outline mt-[24px]">
                    © 2026 NUMA POS — Powered by NUMA
                </p>
            </div>
        </div>
    );
}
