# VorTest

Plataforma de automatización de pruebas con Playwright.

---

## 🚀 Cómo levantar el proyecto

> **Nota de estructura:** este README asume que ya estás parado dentro de
> `vortest-web/` (`cd vortest-web`). El repo raíz (`playwright_vortex/`)
> contiene además `vortest-engine/` (motor de ejecución NestJS, ya
> completamente implementado y conectado — ver más abajo) — ver el
> `README.md` de la raíz del repo para la vista general de ambos proyectos.

### Requisitos previos

- [Node.js](https://nodejs.org/) 20+
- [Docker](https://www.docker.com/) (para PostgreSQL, RabbitMQ y, si querés
  correr todo en contenedores, el resto de los servicios)
- [npm](https://www.npmjs.com/) (viene con Node)

### 1. Levantar PostgreSQL y RabbitMQ con Docker

El compose vive en la **raíz del repo** (un nivel arriba de `vortest-web/`),
porque orquesta todos los servicios (web, recorder, execution-consumer,
engine, RabbitMQ y Postgres) juntos:

```bash
cd ..
docker compose -f docker-compose.dev.yml up postgres rabbitmq -d
cd vortest-web
```

Eso arranca los contenedores `vortest-postgres` (puerto `5432`) y
`vortest-rabbitmq` (puertos `5672`/`15672`).

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

Edita `.env` según necesites — ver la sección "Variables de entorno" más
abajo, que documenta cada una en el propio `.env.example`.

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

Necesitás también `vortest-engine` corriendo (y conectado a RabbitMQ) para
que las ejecuciones de casos de prueba realmente corran — ver
`../vortest-engine/README.md`. Con eso levantado:

```bash
npm run dev
```

Eso arranca en paralelo (`concurrently`):
- **Web (Next.js)** → http://localhost:3000
- **execution-consumer** → consume eventos de progreso/resultado del motor (`engine.events`) y los persiste en la base
- **recorder-worker** → sesiones de grabación (Playwright Codegen)

### 7. Verificar que todo funciona

- Abre http://localhost:3000 e inicia sesión con las credenciales del seed.
- Para inspeccionar la base de datos: `npx prisma studio`

---

## 🛠️ Scripts útiles

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Levanta web + execution-consumer + recorder-worker en paralelo |
| `npm run dev:web` | Solo Next.js |
| `npm run dev:consumer` | Solo el execution-consumer (consume `engine.events`, escribe en la base) |
| `npm run dev:recorder` | Solo el recorder-worker (sesiones de grabación) |
| `npm run consumer` / `npm run recorder` | Igual que los de arriba, sin el flag de watch de `dev` |
| `npm run db:migrate` | Crear/aplicar migraciones |
| `npm run db:seed` | Ejecutar seed |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:reset` | Resetear base de datos (⚠️ borra todo) |
| `npm test` | Ejecutar tests unitarios con Jest |
| `npm run test:e2e` | Ejecutar los specs e2e de `e2e/` (requiere la app corriendo) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (`next lint`) |
| `npm run verify:playwright` | Verifica que `@playwright/test` y el tag del Dockerfile coincidan |
| `npm run cleanup:sesiones` | Purga sesiones de grabación viejas (ver `SESIONES_RETENTION_DAYS`) |

---

## 📁 Estructura del proyecto

```
vortest-web/            # (dentro de playwright_vortex/, hermano de vortest-engine/)
├── app/              # Next.js App Router (páginas y API routes)
├── components/       # Componentes React reutilizables
├── lib/              # Utilidades, hooks, lógica de negocio
├── prisma/           # Schema y migraciones de Prisma
├── scripts/          # execution-consumer, recorder-worker y utilidades
├── e2e/              # Specs e2e de Playwright (npm run test:e2e)
├── types/            # Tipos TypeScript globales
└── README.md         # Este archivo
```

`docker-compose.dev.yml` vive en la raíz del repo (`../docker-compose.dev.yml`), no acá — orquesta este proyecto junto con `vortest-engine/`.

---

## 🐳 Docker Compose (desarrollo)

El `docker-compose.dev.yml` de la raíz del repo levanta **los seis servicios
ya conectados entre sí** — no hay ninguna pieza "próximamente":

- **PostgreSQL 16** (`vortest-postgres`) con healthcheck
- **RabbitMQ** (`vortest-rabbitmq`) con healthcheck y credenciales propias (no `guest/guest`)
- **`engine`** (`vortest-engine/`) — motor de ejecución de Playwright, consume `engine.execute`
- **`web`** (este proyecto) — Next.js (migra, siembra y arranca `next dev`)
- **`execution-consumer`** (este proyecto) — consume `engine.events`, persiste en la base, publica el job del hijo en encadenamientos padre/hijo
- **`recorder`** — recorder-worker del modo grabador (comparte código con `web`, imagen con navegadores)
- Volúmenes persistentes para datos, scripts de Playwright y artefactos

```bash
cd ..
docker compose -f docker-compose.dev.yml up
```

> **Limitación conocida, sin verificar todavía:** el servicio `recorder` lanza un navegador `headed` (`headless: false`, ver `scripts/codegen-runner.ts`) para el modo grabador. Eso necesita una pantalla — dentro de un contenedor Linux normalmente vía Xvfb — y este compose todavía no lo configura ni fue probado con una grabación real de punta a punta en Docker. `web` (que corre siempre headless) sí debería funcionar tal cual.

Gaps conocidos vigentes (no específicos de este proyecto, ver también
`../vortest-engine/README.md` y el `README.md` de la raíz):
- Sin dead-letter queue de RabbitMQ configurada para `engine.execute`.
- Cancelación y encadenamiento padre/hijo probados solo con mocks, no en
  vivo de punta a punta.

---

## 🔐 Variables de entorno

Todas las variables que este proyecto usa (con su descripción, formato
esperado y ejemplo) están documentadas inline en
[`.env.example`](./.env.example) — es la única fuente de verdad; esta
sección no repite la lista para no desincronizarse con el código. Copiá ese
archivo a `.env` y ajustá los valores.

---

## 🧪 Tests

- **Unitarios / integración:** `npm test` (Jest + Testing Library)
- **E2E:** `npm run test:e2e` (Playwright, config dedicada en
  `playwright.e2e.config.ts`, requiere que la app esté corriendo)

---

> Proyecto desarrollado por Vortexbird SAS.
