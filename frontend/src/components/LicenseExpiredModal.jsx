import ReactDOM from 'react-dom';

const WHATSAPP_NUMBER = '523326378746';

const MESSAGES = {
    LICENSE_EXPIRED: {
        icon: 'schedule',
        title: 'Tu licencia ha vencido',
        body: 'Para seguir usando NUMA POS, renueva tu plan. Contáctanos con ventas por WhatsApp y te ayudamos al instante.',
        cta: 'Contactar a ventas',
        waText: (name, key) => `Hola, quiero renovar mi licencia de NUMA POS${name ? ` para ${name}` : ''}${key ? ` (Licencia: ${key})` : ''}.`,
    },
    LICENSE_SUSPENDED: {
        icon: 'pause_circle',
        title: 'Tu licencia está suspendida',
        body: 'Tu acceso ha sido suspendido temporalmente. Contáctanos con soporte para resolverlo.',
        cta: 'Contactar a soporte',
        waText: (name, key) => `Hola, mi licencia de NUMA POS${name ? ` (${name})` : ''}${key ? ` con clave ${key}` : ''} está suspendida y necesito ayuda.`,
    },
    LICENSE_CANCELLED: {
        icon: 'cancel',
        title: 'Tu licencia fue cancelada',
        body: 'Tu licencia ha sido cancelada. Contáctanos con soporte si crees que esto es un error.',
        cta: 'Contactar a soporte',
        waText: (name, key) => `Hola, mi licencia de NUMA POS${name ? ` (${name})` : ''}${key ? ` con clave ${key}` : ''} fue cancelada y necesito soporte.`,
    },
    ACCOUNT_CANCELLED: {
        icon: 'block',
        title: 'Tu cuenta está cancelada',
        body: 'Tu cuenta ha sido cancelada. Contáctanos con soporte si crees que esto es un error.',
        cta: 'Contactar a soporte',
        waText: (name, key) => `Hola, mi cuenta de NUMA POS${name ? ` (${name})` : ''}${key ? ` con licencia ${key}` : ''} está cancelada y necesito soporte.`,
    },
    ACCOUNT_NOT_FOUND: {
        icon: 'error',
        title: 'No encontramos tu cuenta',
        body: 'Hubo un problema con tu cuenta. Contáctanos con soporte para resolverlo.',
        cta: 'Contactar a soporte',
        waText: (name, key) => `Hola, tengo un problema con mi cuenta de NUMA POS${name ? ` (${name})` : ''}${key ? ` y licencia ${key}` : ''} y necesito ayuda.`,
    },
};

export default function LicenseExpiredModal({ code, message, tenantName, licenseKey, onLogout }) {
    const content = MESSAGES[code] || MESSAGES.LICENSE_EXPIRED;

    const waText = encodeURIComponent(content.waText(tenantName, licenseKey));
    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

    return ReactDOM.createPortal(
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="license-modal-title"
style={{ position: 'fixed', inset: 0, zIndex: 999, backgroundColor: 'rgba(11,28,48,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}        >
            <div className="bg-surface-bright rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center gap-4" style={{ width: '100%', maxWidth: '380px' }}>
                <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[32px] text-error" aria-hidden="true">
                        {content.icon}
                    </span>
                </div>

                <div>
                    <h2 id="license-modal-title" className="text-[18px] font-black text-on-surface">
                        {content.title}
                    </h2>
                    <p className="text-[14px] text-on-surface-variant mt-1.5 leading-snug">
                        {message || content.body}
                    </p>
                </div>

                {/* Info de la Licencia y Negocio */}
                {(tenantName || licenseKey) && (
                    <div className="w-full bg-surface-container-low rounded-2xl border border-outline-variant/30 px-4 py-3 flex flex-col gap-1.5">
                        {tenantName && (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-on-surface-variant">Negocio</span>
                                <span className="text-[12px] font-semibold text-on-surface truncate max-w-[180px]">{tenantName}</span>
                            </div>
                        )}
                        {licenseKey && (
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-on-surface-variant">Licencia</span>
                                <span className="font-mono text-[13px] font-black text-on-surface tracking-wider">{licenseKey}</span>
                            </div>
                        )}
                    </div>
                )}

                <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[14px] rounded-2xl py-3.5 transition-colors active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                        chat
                    </span>
                    {content.cta}
                </a>

                <button
                    onClick={onLogout}
                    className="text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
                >
                    Cerrar sesión
                </button>

            </div>
        </div>,
        document.body
    );
}