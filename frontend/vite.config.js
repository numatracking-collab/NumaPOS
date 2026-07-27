import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  // En producción usamos './' para que Electron pueda cargar los assets
  // como rutas relativas desde file:// sin romper el build de web/Android
  // (Capacitor también funciona bien con rutas relativas).
  const base = mode === 'production' ? './' : '/';

  return {
    base,
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3002',
          changeOrigin: true,
        }
      }
    }
  }
})