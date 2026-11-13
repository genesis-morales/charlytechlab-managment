# Charly Tech Lab — Sistema de gestión

CRM + Contabilidad + Web pública para Charly Tech Lab, Quepos, Costa Rica.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS → Vercel
- **Backend:** Node.js + Fastify + TypeScript → Render (free tier)
- **Base de datos:** PostgreSQL → Neon (serverless)
- **Imágenes:** Cloudinary (free tier)
- **ORM:** Prisma

## Estructura del proyecto

```
charlytechlab-managment/
├── backend/
│   ├── prisma/schema.prisma   # Modelo de datos completo
│   ├── src/
│   │   ├── lib/               # config, db, seed
│   │   ├── modules/           # auth, customers, devices, workorders,
│   │   │                      # quotes, financial, inventory, imports,
│   │   │                      # products, suppliers, dashboard, public
│   │   └── server.ts
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── lib/api.ts         # cliente Axios + interceptores JWT
│   │   ├── store/auth.store.ts
│   │   ├── pages/             # Login y módulos del CRM
│   │   ├── web/               # Inicio, catálogo, servicios, nosotros y contacto
│   │   └── App.tsx
│   └── index.html
└── docs/                      # Documentación local, excluida de Git
```

## Setup local

### 1. Clonar e instalar

```bash
npm ci
```

### 2. Configurar el backend

```bash
cd backend
cp .env.example .env
# Editar .env con:
# - DATABASE_URL (de Neon)
# - DIRECT_URL  (de Neon, para migraciones)
# - JWT_SECRET
# - CLOUDINARY_* (cloud name, api key, api secret)
# - ADMIN_EMAIL y ADMIN_PASSWORD (para crear el administrador)
```

### 3. Inicializar la base de datos

```bash
# Desde la raíz
npm run db:generate   # genera el Prisma Client
npm run db:migrate    # corre las migraciones (crea las tablas)
```

### 4. Crear el usuario admin

```bash
# Desde la raíz, con las variables locales configuradas en backend/.env
npm run db:seed
```

El seed exige una contraseña de al menos 12 caracteres y como máximo 72 bytes
UTF-8. No existe una contraseña predeterminada. Si el administrador ya existe,
el seed no cambia su contraseña. Las credenciales locales no se versionan.

### 5. Correr en desarrollo

```bash
# Terminal 1 — backend en :3001
npm run dev:backend

# Terminal 2 — frontend en :5173 (proxy hacia :3001)
npm run dev:frontend
```

Abrir http://localhost:5173

## Servicios previstos

| Servicio | Para qué |
|----------|----------|
| [Neon](https://neon.tech) | PostgreSQL |
| [Render](https://render.com) | Backend Node.js |
| [Vercel](https://vercel.com) | Frontend React |
| [Cloudinary](https://cloudinary.com) | Imágenes; integración de carga pendiente |

## Despliegue

### Backend en Render

1. Crear un **Web Service** con la raíz del repositorio: los workspaces comparten `package-lock.json`.
2. Build command: `npm ci && npm run db:generate && npm run build:backend`.
3. Ejecutar `npm run db:migrate:deploy` como paso de publicación, con respaldo y la conexión de destino revisada.
4. Start command: `npm run start --workspace=backend`.
5. Configurar variables en Render, incluyendo `NODE_ENV=production` y `FRONTEND_URL`. Mantener los secretos fuera del repositorio.

Las migraciones de `backend/prisma/migrations/` se versionan. No se ejecutó
ninguna migración ni se validó un despliegue durante la revisión de la v1.

### Frontend en Vercel

1. Importar el repositorio en Vercel
2. Root directory: `frontend`
3. Variable de entorno: `VITE_API_URL=https://tu-backend.onrender.com/api`

Toda variable `VITE_*` queda visible en el navegador: usar únicamente la URL
pública de la API. Comprobar las redirecciones de la SPA al abrir rutas como
`/login` y `/equipos` directamente en producción.

## Variables de entorno requeridas

Ver `backend/.env.example` para la lista completa.

Ver `frontend/.env.example` para la configuración pública del frontend.

## Revisión antes de subir a GitHub

```bash
npm run db:generate
npm run check
npm audit
```

En Windows, usar `npm.cmd` si PowerShell bloquea `npm.ps1`.

`npm run check` revisa secretos, comprueba el escáner, los reintentos del cliente y
la limpieza de caché al cerrar sesión, compila ambos proyectos y prueba la
autenticación. No conecta con la base real. En la revisión de seguimiento del
13 de noviembre de 2026, Zod se actualizó a 4.6.7 y `npm audit` reportó **cero
vulnerabilidades**. La auditoría se ejecuta por separado y requiere red.

Para comprobar concurrencia y reversiones con PostgreSQL aislado:

```bash
npm run db:generate
npm run build:backend
npm run test:integration
```

El ejecutor inicia su propio clúster en una carpeta temporal y un puerto de
loopback, aplica las migraciones allí, ejecuta los casos de prueba y lo detiene y
elimina. No usa la conexión del `.env`. Busca PostgreSQL 18 en Windows; en otros
entornos usa `pg_config --bindir`. Se puede indicar la carpeta mediante `PG_BIN`.

**Antes de usar este backend con una base existente**, crear un respaldo, verificar
su restauración y probar las migraciones sobre una copia. Las migraciones
versionadas están en `backend/prisma/migrations/`. Ejecutar
`npm run db:migrate:deploy` únicamente con el entorno de destino revisado.

El escáner analiza archivos candidatos, el índice y el historial local de ramas,
etiquetas y referencias remotas. Compara también con secretos de los `.env`
locales habituales sin imprimir sus valores. No inspecciona el estado de GitHub
ni garantiza detectar todos los formatos de credenciales.

Para activar los controles antes de cada commit y push en un clon:

```bash
npm run hooks:install
```

En Linux/macOS, ejecutar también `chmod +x .githooks/pre-commit .githooks/pre-push`.
El workflow de GitHub Actions repite las verificaciones al subir cambios; la revisión local
previa al push es la que evita publicar una credencial detectada.

Se excluyen `.env` reales, claves privadas, dependencias, compilados, respaldos,
exportaciones y el importador local con datos históricos
`backend/src/lib/seed-from-csv.ts`. Ese importador permanece en tu equipo y no
forma parte de la distribución. `docs/` y los archivos `AGENTS.md` también se
conservan localmente y están excluidos de Git. Las plantillas `.env.example`,
migraciones, código, este README y `package-lock.json` sí se versionan.

La documentación ampliada de negocio, revisión y seguimiento permanece en la
carpeta local `docs/`; no se incluye al clonar el repositorio desde GitHub.
