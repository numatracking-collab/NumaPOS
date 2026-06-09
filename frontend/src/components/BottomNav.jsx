import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';

export default function BottomNav() {
    const { tenant, user, license, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // calculate remaining days
    const calculateRemainingDays = (expiresAt) => {
        if (!expiresAt) return 0;
        const now = new Date();
        const expirationDate = new Date(expiresAt);
        const diffTime = expirationDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    const remainingDays = calculateRemainingDays(license?.expiresAt);

    return (
        <nav
            // CELULAR: Altura estándar (h-[76px]) y espacio repartido.
            // ESCRITORIO: Altura grande (h-[135px]) y padding para rescatarlo de la barra de Windows.
            className="h-[76px] pb-2 md:h-[135px] md:pb-4 shrink-0 bg-surface-bright border-t border-outline-variant flex justify-between items-center px-2 md:px-lg shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-50 overflow-x-auto custom-scrollbar"
        >
            {/* Espacio izquierdo (Oculto en celular para aprovechar el ancho) */}
            <div className="hidden md:block flex-1"></div>

            {/* Menú de Navegación Central */}
            {/* En celular ocupan el 100% del ancho y se separan solos (justify-between) */}
            <div className="flex flex-1 md:flex-none justify-between sm:justify-around md:justify-center w-full md:w-auto gap-1 md:gap-12 items-center px-1 md:px-0">
                
                <Link to="/" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/' ? 'text-secondary bg-secondary/10 md:bg-transparent md:hover:bg-secondary/10' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/' ? "'FILL' 1" : "'FILL' 0" }}>point_of_sale</span>
                    <span className="font-label-bold text-[10px] md:text-[11px]">Ventas</span>
                </Link>
                
                <Link to="/inventory" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/inventory' ? 'text-secondary bg-secondary/10 md:bg-transparent md:hover:bg-secondary/10' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/inventory' ? "'FILL' 1" : "'FILL' 0" }}>inventory_2</span>
                    {/* Abreviamos Inventario en pantallas muy pequeñitas */}
                    <span className="font-label-bold text-[10px] md:text-[11px]">
                        <span className="sm:hidden">Invent.</span>
                        <span className="hidden sm:inline">Inventario</span>
                    </span>
                </Link>
                
                <Link to="/history" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/history' ? 'text-secondary bg-secondary/10 md:bg-transparent md:hover:bg-secondary/10' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/history' ? "'FILL' 1" : "'FILL' 0" }}>history</span>
                    <span className="font-label-bold text-[10px] md:text-[11px]">Historial</span>
                </Link>
                
                <Link to="/reports" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/reports' ? 'text-secondary bg-secondary/10 md:bg-transparent md:hover:bg-secondary/10' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/reports' ? "'FILL' 1" : "'FILL' 0" }}>bar_chart</span>
                    <span className="font-label-bold text-[10px] md:text-[11px]">Reportes</span>
                </Link>
                
                <Link to="/marketing" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/marketing' ? 'text-secondary bg-secondary/10 md:bg-transparent md:hover:bg-secondary/10' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/marketing' ? "'FILL' 1" : "'FILL' 0" }}>percent_discount</span>
                    <span className="font-label-bold text-[10px] md:text-[11px]">Promoción</span>
                </Link>

                <Link to="/settings" className={`flex flex-col items-center gap-1 md:gap-xs px-2 md:px-lg py-1.5 md:py-xs rounded-lg transition-colors ${location.pathname === '/settings' ? 'text-secondary bg-secondary/10 md:bg-transparent md:hover:bg-secondary/10' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
                    <span className="material-symbols-outlined md:text-[24px] text-[22px]" style={{ fontVariationSettings: location.pathname === '/settings' ? "'FILL' 1" : "'FILL' 0" }}>settings</span>
                    <span className="font-label-bold text-[10px] md:text-[11px]">Ajustes</span>
                </Link>

                {/* Botón de Salir exclusivo para celular (integrado en los iconos centrales) */}
                <button onClick={handleLogout} className="md:hidden flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-error hover:bg-error/10 transition-colors">
                    <span className="material-symbols-outlined text-[22px]">logout</span>
                    <span className="font-label-bold text-[10px]">Salir</span>
                </button>
            </div>

            {/* Sección Derecha: Información y Logout (Solo visible en Escritorio) */}
            <div className="hidden md:flex flex-1 justify-end items-center gap-4">
                {tenant && license && (
                    <div className="flex flex-col items-end text-right text-on-surface-variant mr-2">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-[13px] text-on-surface">{user?.name}</span>
                            <span className="text-[11px] font-mono bg-surface-container-high text-on-surface px-2 py-0.5 rounded-md border border-outline-variant/30">
                                {license.key}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] mt-0.5">
                            <span className="capitalize text-secondary font-medium">Plan {license.plan}</span>
                            <span className="text-outline-variant">•</span>
                            <span className={remainingDays <= 5 ? "text-error font-semibold" : "text-on-surface-variant"}>
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
    );
}