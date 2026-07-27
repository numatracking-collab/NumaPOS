# NUMA POS

Sistema de punto de venta multi-plataforma.

| Plataforma | Tecnología | Estado |
|---|---|---|
| Web (navegador) | React + Vite → Render | ✅ Producción |
| Android | Capacitor 8 | ✅ Producción |
| Windows | Electron | ✅ Producción |

---

## Requisitos previos

Instala esto una sola vez en tu PC antes de empezar:

- [Node.js 20+](https://nodejs.org/) (incluye npm)
- [Git](https://git-scm.com/)
- [Android Studio](https://developer.android.com/studio) — solo si vas a trabajar con la app Android

---

## Clonar y configurar el proyecto

### 1. Clonar el repositorio

```bash
git clone <URL_DEL_REPO>
cd "NUMA POS"
```

### 2. Instalar dependencias del backend

```bash
cd backend
npm install
```

Crea el archivo de variables de entorno del backend:

```bash
# Crea backend/.env con este contenido (pide los valores a Luis):
DATABASE_URL=...
JWT_SECRET=...
JWT_EXPIRES_IN=24h
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### 3. Instalar dependencias del frontend

```bash
cd ../frontend
npm install
```

Crea el archivo de variables de entorno del frontend:

```bash
# Crea frontend/.env con este contenido:
VITE_API_URL=http://localhost:3002/api
```

> Para apuntar al backend de producción en Render usa:
> `VITE_API_URL=https://numaposback.onrender.com/api`

---

## Correr en desarrollo

Abre **dos terminales** simultáneas:

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
El backend queda en `http://localhost:3002`

**Terminal 2 — Frontend web:**
```bash
cd frontend
npm run dev
```
La app web queda en `http://localhost:5173`

---

## Correr Electron (Windows desktop) en desarrollo

```bash
cd frontend
npm run electron:dev
```

Esto compila el frontend y abre la app en una ventana de Electron.
Úsalo para probar cambios que afecten la versión de escritorio.

---

## Flujo de trabajo con Git

### Ramas

| Rama | Propósito |
|---|---|
| `main` | Producción — solo Luis hace merge aquí |
| `dev` | Integración — base para nuevas ramas |
| `feature/nombre` | Tu rama de trabajo |

### Pasos para cada tarea

```bash
# 1. Asegúrate de estar en dev y actualizado
git checkout dev
git pull origin dev

# 2. Crea tu rama de trabajo
git checkout -b feature/nombre-descriptivo

# 3. Trabaja, haz commits frecuentes
git add .
git commit -m "descripcion clara del cambio"

# 4. Cuando termines, sube tu rama
git push origin feature/nombre-descriptivo

# 5. Abre un Pull Request en GitHub hacia la rama `dev`
# Luis revisa, aprueba y hace merge
```

### Convención de commits

```
feat: nueva funcionalidad
fix: corrección de bug
style: cambios de UI sin lógica
refactor: reorganización de código
docs: documentación
```

---

## Desplegar cambios a producción

**Solo Luis hace esto** después de revisar y aprobar un PR.

### Web + Android

```bash
cd frontend

# 1. Build del frontend
npm run build

# 2. Sincronizar con Android (si hay cambios en la app móvil)
npx cap sync android

# 3. Push al repo — Render despliega el backend automáticamente
git push origin main
```

### Android — generar nuevo APK

1. Subir `versionCode` (+1) y `versionName` en `frontend/android/app/build.gradle`
2. Abrir Android Studio → Build → Generate Signed APK
3. Keystore en `frontend/android/numapos-release-key.jks` (credenciales con Luis)

### Windows — generar nuevo instalador

```bash
cd frontend
# Subir "version" en package.json antes de generar
npm run electron:build
# Instalador generado en: frontend/dist-electron/NUMA POS Setup X.X.X.exe
```

---

## Estructura del proyecto

```
NUMA POS/
├── backend/                  # Node.js + Express + PostgreSQL (Neon)
│   ├── config/
│   │   └── db.js             # Conexión a PostgreSQL
│   ├── routes/               # Rutas de la API
│   │   ├── auth.js
│   │   ├── sales.js
│   │   ├── products.js
│   │   ├── cashRegisters.js
│   │   └── ...
│   ├── middleware/
│   │   └── verifyToken.js    # JWT auth — inyecta req.user.tenantId
│   └── index.js              # Entry point del servidor
│
└── frontend/                 # React + Vite + Tailwind
    ├── electron/
    │   ├── main.cjs          # Proceso principal de Electron
    │   └── preload.cjs       # Bridge IPC → window.electronAPI
    ├── src/
    │   ├── services/
    │   │   ├── api.js                    # Todos los servicios HTTP
    │   │   ├── printerService.js         # Impresión (web/Android/Windows)
    │   │   ├── runtimeEnv.js             # Detecta web/capacitor/electron
    │   │   ├── capacitorBtAdapter.js     # BLE nativo Android
    │   │   └── electronPrinterAdapter.js # IPC Windows
    │   ├── components/       # Componentes React reutilizables
    │   ├── pages/            # Páginas principales
    │   ├── context/          # AuthContext, etc.
    │   └── main.jsx          # Entry point React
    ├── android/              # Proyecto Android (generado por Capacitor)
    ├── assets/               # Íconos para Capacitor/Electron
    ├── public/               # Assets estáticos (SVGs, etc.)
    ├── capacitor.config.json
    ├── vite.config.js
    └── package.json
```

---

## Variables de entorno — resumen

| Archivo | Variable | Descripción |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | Cadena de conexión PostgreSQL (Neon) |
| `backend/.env` | `JWT_SECRET` | Secreto para firmar tokens JWT |
| `backend/.env` | `JWT_EXPIRES_IN` | Duración del token (ej. `24h`) |
| `backend/.env` | `CLOUDINARY_*` | Credenciales para subida de imágenes |
| `frontend/.env` | `VITE_API_URL` | URL base de la API |

> **Nunca subas archivos `.env` al repositorio.** Están en `.gitignore`.
> Pide los valores a Luis directamente.

---

## Preguntas frecuentes

**¿Por qué hay dos `build.gradle` en Android?**
Uno es de nivel raíz (`android/build.gradle`) y otro del módulo app (`android/app/build.gradle`). El `versionCode` y `versionName` están en el segundo.

**¿Por qué los archivos de Electron son `.cjs` y no `.js`?**
El proyecto usa `"type": "module"` en `package.json` (ES modules), pero el proceso principal de Electron requiere CommonJS. La extensión `.cjs` le dice a Node que use CommonJS para esos archivos específicamente.

**¿Puedo probar cambios de Android sin un celular físico?**
Sí, con el emulador de Android Studio. Pero el Bluetooth no funciona en el emulador — para probar impresión BT necesitas un dispositivo físico.

**¿Dónde está la keystore de Android?**
En `frontend/android/numapos-release-key.jks`. Este archivo está en `.gitignore` y **no está en el repo** — lo tiene Luis. Sin él no se pueden generar APKs firmados.