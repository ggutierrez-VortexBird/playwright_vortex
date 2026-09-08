# playwright_vortex

Plataforma de automatización de pruebas con Playwright (ACTA).

---

## 🚀 Cómo levantar el proyecto

### Requisitos previos

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (para PostgreSQL)
- [npm](https://www.npmjs.com/) (viene con Node)

### 1. Levantar PostgreSQL con Docker

```bash
docker compose -f docker-compose.dev.yml up postgres -d
```

Eso crea y arranca el contenedor `acta-postgres` en el puerto `5432`.

### 2. Instalar dependencias

```bash
npm install
```

> El `postinstall` descargará automáticamente los navegadores de Playwright.

### 3. Configurar variables de entorno

Copia el archivo de ejemplo:

```bash
cp .env.example .env
```

Edita `.env` si necesitas cambiar contraseñas o el secreto de sesión. Por defecto ya funciona para desarrollo local.

### 4. Crear las tablas en la base de datos

```bash
npx prisma migrate dev
```

Te pedirá un nombre para la migración; escribe `init` (o el que prefieras).

> Alternativa rápida sin generar archivos de migración: `npx prisma db push`

### 5. Ejecutar el seed (cargar usuario superadmin)

```bash
npx prisma db seed
```

Esto crea el usuario inicial:

| Campo         | Valor por defecto     |
|---------------|-----------------------|
| Email         | `admin@admin.com`     |
| Contraseña    | `admin123` (definida en `.env` como `SEED_ADMIN_PASSWORD`) |
| Rol           | `superadmin`          |

### 6. Levantar la aplicación

```bash
npm run dev
```

Eso arranca en paralelo:
- **Web (Next.js)** → http://localhost:3000
- **Worker** → proceso en segundo plano que ejecuta los tests de Playwright

### 7. Verificar que todo funciona

- Abre http://localhost:3000 e inicia sesión con las credenciales del seed.
- Para inspeccionar la base de datos: `npx prisma studio`

---

## 🛠️ Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Levanta web + worker en paralelo |
| `npm run dev:web` | Solo Next.js |
| `npm run dev:worker` | Solo el worker |
| `npm run db:migrate` | Crear/aplicar migraciones |
| `npm run db:seed` | Ejecutar seed |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:reset` | Resetear base de datos (⚠️ borra todo) |
| `npm test` | Ejecutar tests unitarios con Jest |
| `npm run worker` | Ejecutar el worker manualmente |

---

## 📁 Estructura del proyecto

```
playwright_vortex/
├── app/              # Next.js App Router (páginas y API routes)
├── components/       # Componentes React reutilizables
├── lib/              # Utilidades, hooks, lógica de negocio
├── prisma/           # Schema y migraciones de Prisma
├── scripts/          # Scripts auxiliares (worker, etc.)
├── types/            # Tipos TypeScript globales
├── docker-compose.dev.yml  # Compose solo para desarrollo
└── README.md         # Este archivo
```

---

## 🐳 Docker Compose (desarrollo)

El repositorio incluye `docker-compose.dev.yml` que levanta:

- **PostgreSQL 16** (`acta-postgres`) con healthcheck
- **`app`** — Next.js (migra, siembra y arranca `next dev`)
- **`worker`** — motor de ejecución (`scripts/worker.ts`), antes ausente del compose: sin este servicio ningún "Ejecutar" corría dentro de Docker aunque `app` y `postgres` estuvieran sanos
- **`recorder`** — recorder-worker del modo grabador
- Volúmenes persistentes para datos, scripts de Playwright y artefactos

Los tres servicios de Node comparten el mismo `Dockerfile` (basado en la imagen oficial de Playwright, que trae Chromium/Firefox/WebKit y sus dependencias del sistema preinstaladas) y solo difieren en el `command:`.

```bash
docker compose -f docker-compose.dev.yml up
```

> **Limitación conocida, sin verificar todavía:** el servicio `recorder` lanza un navegador `headed` (`headless: false`, ver `scripts/codegen-runner.ts`) para el modo grabador. Eso necesita una pantalla — dentro de un contenedor Linux normalmente vía Xvfb — y este compose todavía no lo configura ni fue probado con una grabación real de punta a punta en Docker. `app` y `worker` (que corren siempre headless) sí deberían funcionar tal cual.

---

## 🔐 Variables de entorno

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Conexión a PostgreSQL | `postgresql://acta:acta@localhost:5432/acta?schema=public` |
| `SESSION_SECRET` | Secreto para sesiones (mínimo 32 chars) | `acta-super-secret-key-2026-vortexbird-sas-32chars` |
| `SEED_ADMIN_PASSWORD` | Contraseña del usuario seed | `admin123` |
| `NODE_ENV` | Entorno de ejecución | `development` |

---

## 🧪 Tests

- **Unitarios / integración:** `npm test` (Jest + Testing Library)
- **E2E:** `npx playwright test` (requiere que la app esté corriendo)

---

> Proyecto desarrollado por Vortexbird SAS.
