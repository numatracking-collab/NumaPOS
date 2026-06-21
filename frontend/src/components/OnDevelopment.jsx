/* ═══════════════════════════════════════════════════════════════════════════
   OnDevelopment.jsx
   Pantalla de "módulo en desarrollo" — reutilizable en cualquier sección
   que aún no esté lista para producción.
   — title / message son personalizables, pero traen un default genérico.
═══════════════════════════════════════════════════════════════════════════ */

export default function OnDevelopment({
    title = '¡Ya casi está listo!',
    message = 'Estamos trabajando en el desarrollo de este módulo, lo podrás utilizar muy pronto.',
}) {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center gap-md px-lg text-center bg-background">
            <MonkeyAtComputerIllustration />

            <div className="flex flex-col gap-xs max-w-[360px]">
                <h2 className="font-bold text-[20px] text-on-surface">{title}</h2>
                <p className="text-[14px] text-on-surface-variant leading-relaxed">{message}</p>
            </div>
        </div>
    );
}

/* ── Ilustración: monito trabajando en una laptop ────────────────────────── */
function MonkeyAtComputerIllustration() {
    return (
        <svg
            width="220"
            height="190"
            viewBox="0 0 220 190"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/* Sombra del escritorio */}
            <ellipse cx="110" cy="178" rx="80" ry="8" fill="#000000" opacity="0.06" />

            {/* Escritorio */}
            <rect x="30" y="150" width="160" height="10" rx="3" fill="#B98C5A" />
            <rect x="38" y="160" width="10" height="20" rx="2" fill="#9C7344" />
            <rect x="172" y="160" width="10" height="20" rx="2" fill="#9C7344" />

            {/* Laptop — base */}
            <rect x="78" y="138" width="64" height="14" rx="3" fill="#5C6BC0" />
            {/* Laptop — pantalla */}
            <rect x="84" y="98" width="52" height="42" rx="3" fill="#7986CB" />
            <rect x="88" y="102" width="44" height="32" rx="2" fill="#E8EAF6" />
            {/* Líneas de "código" en pantalla */}
            <rect x="92" y="108" width="22" height="3" rx="1.5" fill="#9FA8DA" />
            <rect x="92" y="114" width="30" height="3" rx="1.5" fill="#C5CAE9" />
            <rect x="92" y="120" width="16" height="3" rx="1.5" fill="#9FA8DA" />
            <rect x="92" y="126" width="26" height="3" rx="1.5" fill="#C5CAE9" />

            {/* Cola del mono (detrás del cuerpo) */}
            <path
                d="M58 150 C 30 150, 24 110, 46 96"
                stroke="#A9774F"
                strokeWidth="10"
                strokeLinecap="round"
                fill="none"
            />

            {/* Cuerpo */}
            <ellipse cx="110" cy="150" rx="34" ry="26" fill="#C68A52" />
            {/* Pancita */}
            <ellipse cx="110" cy="154" rx="20" ry="16" fill="#EAC9A0" />

            {/* Brazo izquierdo (sobre el teclado) */}
            <path d="M86 140 Q 78 150, 92 152" stroke="#C68A52" strokeWidth="11" strokeLinecap="round" fill="none" />
            {/* Brazo derecho (sobre el teclado) */}
            <path d="M134 140 Q 142 150, 128 152" stroke="#C68A52" strokeWidth="11" strokeLinecap="round" fill="none" />

            {/* Orejas */}
            <circle cx="84" cy="100" r="11" fill="#C68A52" />
            <circle cx="84" cy="100" r="6" fill="#EAC9A0" />
            <circle cx="136" cy="100" r="11" fill="#C68A52" />
            <circle cx="136" cy="100" r="6" fill="#EAC9A0" />

            {/* Cabeza */}
            <circle cx="110" cy="104" r="30" fill="#C68A52" />
            {/* Cara (zona clara) */}
            <ellipse cx="110" cy="110" rx="20" ry="17" fill="#EAC9A0" />

            {/* Ojos — concentrado en la pantalla */}
            <ellipse cx="102" cy="107" rx="2.6" ry="3.4" fill="#4A2E1A" />
            <ellipse cx="118" cy="107" rx="2.6" ry="3.4" fill="#4A2E1A" />

            {/* Cejas (concentración) */}
            <path d="M97 100 q 5 -3 9 0" stroke="#4A2E1A" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            <path d="M114 100 q 5 -3 9 0" stroke="#4A2E1A" strokeWidth="1.6" strokeLinecap="round" fill="none" />

            {/* Nariz/boca pequeña sonrisa */}
            <path d="M104 116 q 6 5 12 0" stroke="#4A2E1A" strokeWidth="1.6" strokeLinecap="round" fill="none" />

            {/* Mechón de pelo */}
            <path d="M100 78 q 10 -10 20 0" stroke="#A9774F" strokeWidth="4" strokeLinecap="round" fill="none" />

            {/* Taza de café junto al laptop */}
            <rect x="150" y="142" width="14" height="12" rx="2" fill="#FFFFFF" stroke="#D9C7B8" strokeWidth="1" />
            <path d="M164 145 q 6 0 6 4 t -6 4" stroke="#D9C7B8" strokeWidth="1.4" fill="none" />
            <path d="M153 137 q 1 -4 -1 -6 M157 137 q 1 -4 -1 -6 M161 137 q 1 -4 -1 -6"
                stroke="#D9C7B8" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
    );
}