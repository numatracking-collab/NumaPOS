const WHATSAPP_NUMBER = '523326378746';

const MESSAGES = {
    LICENSE_EXPIRED: {
        icon:  'schedule',
        title: 'Tu licencia ha vencido',
        body:  'Para seguir usando NUMA POS, renueva tu plan. Contáctanos por WhatsApp y te ayudamos al instante.',
    },
    ACCOUNT_CANCELLED: {
        icon:  'block',
        title: 'Tu cuenta está cancelada',
        body:  'Si crees que esto es un error o quieres reactivar tu cuenta, contáctanos.',
    },
    ACCOUNT_NOT_FOUND: {
        icon:  'error',
        title: 'No encontramos tu cuenta',
        body:  'Hubo un problema con tu cuenta. Contáctanos para resolverlo.',
    },
};

export default function LicenseExpiredModal({ code, message, tenantName, onLogout }) {
    const content = MESSAGES[code] || MESSAGES.LICENSE_EXPIRED;

    const waText = encodeURIComponent(
        `Hola, quiero renovar mi licencia de NUMA POS${tenantName ? ` para ${tenantName}` : ''}.`
    );
    const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${waText}`;

    return (
        <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="license-modal-title"
            className="fixed inset-0 z-[999] bg-on-surface/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
            <div className="bg-surface-bright rounded-3xl shadow-2xl max-w-sm w-full p-6 flex flex-col items-center text-center gap-4">

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

                {/* AQUÍ SE CORRIGIÓ: Se añadió la etiqueta de apertura <a */}
                <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[14px] rounded-2xl py-3.5 transition-colors active:scale-[0.98]"
                >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                        chat
                    </span>
                    Renovar por WhatsApp
                </a>

                <button
                    onClick={onLogout}
                    className="text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
                >
                    Cerrar sesión
                </button>

            </div>
        </div>
    );
}