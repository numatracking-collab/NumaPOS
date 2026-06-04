/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "surface-dim": "#cbdbf5",
                "on-error": "#ffffff",
                "on-primary-container": "#7c839b",
                "secondary-fixed": "#d8e2ff",
                "outline": "#76777d",
                "inverse-primary": "#bec6e0",
                "on-background": "#0b1c30",
                "inverse-on-surface": "#eaf1ff",
                "on-surface-variant": "#45464d",
                "on-tertiary": "#ffffff",
                "secondary": "#0058be",
                "background": "#f8f9ff",
                "surface-container-low": "#eff4ff",
                "surface-variant": "#d3e4fe",
                "on-secondary-fixed-variant": "#004395",
                "on-tertiary-container": "#009668",
                "tertiary": "#000000",
                "surface-container-highest": "#d3e4fe",
                "tertiary-container": "#002113",
                "error": "#ba1a1a",
                "primary-fixed": "#dae2fd",
                "tertiary-fixed": "#6ffbbe",
                "on-tertiary-fixed": "#002113",
                "on-tertiary-fixed-variant": "#005236",
                "surface-container-high": "#dce9ff",
                "surface-container": "#e5eeff",
                "surface-tint": "#565e74",
                "secondary-container": "#2170e4",
                "on-secondary": "#ffffff",
                "primary": "#000000",
                "on-error-container": "#93000a",
                "secondary-fixed-dim": "#adc6ff",
                "tertiary-fixed-dim": "#4edea3",
                "surface-container-lowest": "#ffffff",
                "on-secondary-container": "#fefcff",
                "on-primary-fixed": "#131b2e",
                "on-surface": "#0b1c30",
                "error-container": "#ffdad6",
                "on-secondary-fixed": "#001a42",
                "surface": "#f8f9ff",
                "on-primary": "#ffffff",
                "outline-variant": "#c6c6cd",
                "surface-bright": "#f8f9ff",
                "primary-fixed-dim": "#bec6e0",
                "inverse-surface": "#213145",
                "primary-container": "#131b2e",
                "on-primary-fixed-variant": "#3f465c"
            },
            borderRadius: {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
            },
            spacing: {
                "lg": "24px",
                "xl": "32px",
                "sm": "8px",
                "base": "4px",
                "touch-target": "44px",
                "md": "16px",
                "xs": "4px"
            }
        },
    },
    plugins: [
        // Quitamos el require() antiguo para evitar errores de compatibilidad en Vite moderno
    ],
}