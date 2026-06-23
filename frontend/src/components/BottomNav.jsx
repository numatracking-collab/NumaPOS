import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
    const { tenant, user, license, logout } = useAuth();
    const navigate  = useNavigate();
    const location  = useLocation();
    const [showInfo, setShowInfo] = useState(false);

    const handleLogout = () => { logout(); navigate('/login'); };

    const calculateRemainingDays = (expiresAt) => {
        if (!expiresAt) return 0;
        const diff = new Date(expiresAt) - new Date();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    const remainingDays = calculateRemainingDays(license?.expiresAt);
    const isExpiringSoon = remainingDays <= 5 && remainingDays > 0;

    return (
        <div className="shrink-0 z-50">

            {/* ── Panel desplegable de licencia — SOLO MÓVIL ────────────────── */}
            <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-surface-bright border-t border-outline-variant/30 ${showInfo ? 'max-h-48' : 'max-h-0 border-t-0'}`}>
                {license && tenant && (
                    <div className="px-4 py-3 flex flex-col gap-2.5">

                        {/* Negocio + usuario */}
                        <div className="flex items-center justify-between">
                            <div className="min-w-0">
                                <p className="text-[13px] font-black text-on-surface truncate">{tenant.name}</p>
                                <p className="text-[11px] text-on-surface-variant truncate">{user?.name}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize border ${
                                license.plan === 'free'
                                    ? 'bg-surface-container text-on-surface-variant border-outline-variant/40'
                                    : 'bg-secondary/10 text-secondary border-secondary/20'
                            }`}>
                                {license.plan}
                            </span>
                        </div>

                        {/* Clave de licencia */}
                        <div className="flex items-center justify-between bg-surface-container-low rounded-lg px-3 py-2 border border-outline-variant/30">
                            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-widest">Licencia</span>
                            <span className="font-mono text-[13px] font-black text-on-surface tracking-wider">
                                {license.key || '—'}
                            </span>
                        </div>

                        {/* Vencimiento */}
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-on-surface-variant">
                                Vence: {new Date(license.expiresAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className={`text-[11px] font-bold ${
                                remainingDays === 0 ? 'text-error' : isExpiringSoon ? 'text-error' : 'text-on-surface-variant'
                            }`}>
                                {remainingDays === 0 ? 'Vencida' : `${remainingDays} días restantes`}
                            </span>
                        </div>

                    </div>
                )}
            </div>

            {/* ── Barra de navegación ───────────────────────────────────────── */}
            <nav className="h-[76px] pb-2 md:h-[135px] md:pb-4 bg-surface-bright border-t border-outline-variant flex justify-between items-center px-2 md:px-lg shadow-[0_-4px_12px_rgba(0,0,0,0.03)] overflow-x-auto custom-scrollbar">

                {/* Espacio izquierdo (solo escritorio) */}
                <div className="hidden md:block flex-1" />

                {/* Menú central */}
                <div className="flex flex-1 md:flex-none justify-between sm:justify-around md:justify-center w-full md:w-auto gap-1 md:gap-12 items-center px-1 md:px-0">

                    <Link to="/" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/' ? 'text-secondary bg-secondary/10 md:bg-transparent' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                        <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/' ? "'FILL' 1" : "'FILL' 0" }}>point_of_sale</span>
                        <span className="font-label-bold text-[10px] md:text-[11px]">Ventas</span>
                    </Link>

                    <Link to="/inventory" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/inventory' ? 'text-secondary bg-secondary/10 md:bg-transparent' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                        <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/inventory' ? "'FILL' 1" : "'FILL' 0" }}>inventory_2</span>
                        <span className="font-label-bold text-[10px] md:text-[11px]">
                            <span className="sm:hidden">Invent.</span>
                            <span className="hidden sm:inline">Inventario</span>
                        </span>
                    </Link>

                    <Link to="/history" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/history' ? 'text-secondary bg-secondary/10 md:bg-transparent' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                        <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/history' ? "'FILL' 1" : "'FILL' 0" }}>history</span>
                        <span className="font-label-bold text-[10px] md:text-[11px]">Historial</span>
                    </Link>

                    <Link to="/reports" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/reports' ? 'text-secondary bg-secondary/10 md:bg-transparent' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                        <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/reports' ? "'FILL' 1" : "'FILL' 0" }}>bar_chart</span>
                        <span className="font-label-bold text-[10px] md:text-[11px]">Reportes</span>
                    </Link>

                    <Link to="/marketing" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/marketing' ? 'text-secondary bg-secondary/10 md:bg-transparent' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                        <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/marketing' ? "'FILL' 1" : "'FILL' 0" }}>percent_discount</span>
                        <span className="font-label-bold text-[10px] md:text-[11px]">Promoción</span>
                    </Link>

                    <Link to="/settings" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/settings' ? 'text-secondary bg-secondary/10 md:bg-transparent' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                        <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/settings' ? "'FILL' 1" : "'FILL' 0" }}>settings</span>
                        <span className="font-label-bold text-[10px] md:text-[11px]">Ajustes</span>
                    </Link>

                    {/* Botón info de licencia — SOLO MÓVIL */}
                    <button
                        onClick={() => setShowInfo(v => !v)}
                        className={`md:hidden flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-colors relative ${
                            showInfo
                                ? 'text-secondary bg-secondary/10'
                                : 'text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                        aria-label="Ver información de licencia"
                    >
                        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: showInfo ? "'FILL' 1" : "'FILL' 0" }}>
                            badge
                        </span>
                        <span className="font-label-bold text-[10px]">Licencia</span>
                        {/* Punto rojo si está por vencer */}
                        {isExpiringSoon && (
                            <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-error border-2 border-surface-bright" />
                        )}
                    </button>

                    {/* Botón salir — SOLO MÓVIL */}
                    <button
                        onClick={handleLogout}
                        className="md:hidden flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-error hover:bg-error/10 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[22px]">logout</span>
                        <span className="font-label-bold text-[10px]">Salir</span>
                    </button>

                </div>

                {/* Sección derecha — SOLO ESCRITORIO */}
                <div className="hidden md:flex flex-1 justify-end items-center gap-4">
                    {tenant && license && (
                        <div className="flex flex-col items-end text-right text-on-surface-variant mr-2">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-[13px] text-on-surface">{user?.name}</span>
                                <span className="text-[11px] font-mono bg-surface-container-high text-on-surface px-2 py-0.5 rounded-md border border-outline-variant/30 tracking-wider">
                                    {license.key || '—'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] mt-0.5">
                                <span className="capitalize text-secondary font-medium">Plan {license.plan}</span>
                                <span className="text-outline-variant">•</span>
                                <span className={isExpiringSoon ? 'text-error font-semibold' : 'text-on-surface-variant'}>
                                    Vence: {new Date(license.expiresAt).toLocaleDateString()}
                                    <span className="ml-1 opacity-80">({remainingDays} días rest.)</span>
                                </span>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-surface-container-low text-error hover:bg-error hover:text-on-error transition-colors active:scale-95 border border-outline-variant/30"
                        title="Cerrar sesión"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                    </button>
                </div>

            </nav>
        </div>
    );
}