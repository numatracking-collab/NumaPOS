import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Carga las variables de entorno según el modo actual (development, production, etc.)
  // El proceso busca en la raíz del proyecto (process.cwd())
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          // Usamos la variable de entorno. Si no existe, cae al fallback (3002)
          target: env.VITE_API_URL || 'http://localhost:3002',  
          changeOrigin: true,
        }
      }
    }
  }
})