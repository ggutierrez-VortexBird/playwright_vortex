# Exploration: HU-1.2 — Entorno de desarrollo reproducible

## Current State

### docker-compose.dev.yml YA EXISTE (parcialmente roto)
El archivo `docker-compose.dev.yml` fue creado en commits previos (HU-1.1, HU-0.2). Contains two services:

- **`postgres` service** ✅ — Correcto y funcional:
  - Image: `postgres:16-alpine`
  - Exposed port: `5432:5432`
  - Credentials: `acta/acta/acta` — coinciden exactamente con `DATABASE_URL`
  - Volume: `postgres-data:/var/lib/postgresql/data` → cumple AC-2 (persistencia)
  - Healthcheck configurado con `pg_isready`

- **`app` service** ❌ — references a `Dockerfile` que **NO EXISTE** en el repositorio. El `docker compose up` falla inmediatamente al intentar construir la imagen.

### DATABASE_URL ya es compatible
```env
DATABASE_URL="postgresql://acta:acta@localhost:5432/acta?schema=public"
```
- Usa `localhost` (no el hostname `postgres`), lo cual es correcto para el flujo: `npm run dev` (host) → `localhost:5432` (contenedor docker)
- Credenciales coinciden exactamente con el servicio postgres del compose
- Puerto 5432 expuesto en el host

### Prisma listo
- `prisma/schema.prisma` tiene datasource postgresql con `env("DATABASE_URL")`
- Migración `20260806145203_init` aplicada — 11 tablas + 3 enums
- `lib/db.ts` exporta un singleton de PrismaClient con log condicional en dev
- Scripts en package.json: `db:generate`, `db:migrate`, `db:push`, `db:seed`, `db:studio`, `db:reset`

### Estructura del proyecto
```
playwright_vortex/          ← proyecto real (NO la raíz del repo)
├── app/                    # Next.js App Router (layout, login, dashboard, api)
├── lib/db.ts               # Prisma singleton
├── prisma/
│   ├── schema.prisma       # 11 modelos + 3 enums, Postgres 16+
│   └── migrations/         # Migración inicial aplicada
├── docker-compose.dev.yml  # YA EXISTE (postgres OK, app service roto)
├── .env                    # DATABASE_URL=localhost:5432 (correcto para dev local)
├── .env.example            # Misma配置的
├── package.json            # scripts: dev, db:*, test, build
└── next.config.ts          # output: "standalone"
```

### Rama actual: `develop`
El prompt indica `feature/hu1-2-entorno-desarrollo-reproducible` pero git muestra `develop`. El docker-compose.dev.yml ya está en develop (commits da300c6, 140cca7).

---

## Affected Areas

- `docker-compose.dev.yml` — necesita corregirse (quitar/recuperar app service + Dockerfile)
- `.env` — ya correcto, no requiere cambios
- `.env.example` — ya correcto, no requiere cambios
- `prisma/schema.prisma` — no requiere cambios (usa DATABASE_URL)
- `lib/db.ts` — no requiere cambios
- `openspec/config.yaml` — actualizar `status` de `stack-planned-not-installed` si se desea reflejar que el stack está instalado

---

## Approaches

### Approach A: Eliminar el `app` service — solo Postgres
**Descripción**: Strip down `docker-compose.dev.yml` para contener **únicamente el servicio postgres**. El developer corre `npm run dev` localmente (host), conectando a `localhost:5432`.

```
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment: { POSTGRES_USER: acta, POSTGRES_PASSWORD: acta, POSTGRES_DB: acta }
    volumes: [postgres-data:/var/lib/postgresql/data]
    healthcheck: { test: pg_isready, interval: 5s, timeout: 5s, retries: 5 }
```

| | |
|---|---|
| **Pros** | Zero build time en `docker compose up`; menos puntos de falla; flujo familiar (Next.js en host, DB en Docker); AC-1 ✅ y AC-2 ✅ |
| **Cons** | No es "todo en Docker"; difiere de la intención original del archivo (que incluía app service) |
| **Effort** | **Low** — eliminar ~20 líneas del compose |

### Approach B: Crear Dockerfile + mantener todo en Docker
**Descripción**: Crear el `Dockerfile` faltante para el `app` service. El developer levanta todo con `docker compose up` y accede a `localhost:3000`. Requiere que `DATABASE_URL` en el .env de desarrollo apunte a `postgres:5432` (hostname docker), NO `localhost`.

```
# Dockerfile (multi-stage dev)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "dev"]
```

| | |
|---|---|
| **Pros** | Entorno 100% reproducible en Docker;近づけやすい para nuevos devs |
| **Cons** | Build time significativo en cada `docker compose up`; requiere cambiar DATABASE_URL a `postgres:5432`; más complejo; el output "standalone" de next.config.ts está pensado para producción, no dev |
| **Effort** | **High** — Dockerfile, ajustar DATABASE_URL, resolver volúmenes dev, networking |

### Approach C: Dos compose files
**Descripción**: Mantener `docker-compose.dev.yml` solo con Postgres (Approach A) + crear `docker-compose.app.yml` separado para el app service. Cada uno se levanta según necesidad.

| | |
|---|---|
| **Pros** | Flexibility máxima; separation of concerns |
| **Cons** | Más archivos de documentación/maintenance |
| **Effort** | **Medium** |

---

## Recommendation

**Approach A (Postgres-only compose)** es la más adecuada para esta HU:

1. **AC-1** y **AC-2** se cumplen sin cambiar `.env`
2. El flujo `npm run dev` (host) → `localhost:5432` (docker postgres) es exactamente el described in AC
3. Esfuerzo mínimo — solo limpiar líneas rotas del compose existente
4. Mantiene la DX de desarrollo local (hot reload de Next.js) que es preferida en equipos que ya tienen Node.js instalado

La intención original del `app` service parece ser para un **Playwright worker** (hay un volume `playwright-scripts` y `artefactos` que no tienen sentido para el app Next.js). Eso pertenecería a otra HU. Para HU-1.2, enfocarse en Postgres reproducible.

> ⚠️ **Nota importante**: git muestra que estamos en `develop`, no en `feature/hu1-2-entorno-desarrollo-reproducible`. Si esta HU necesita su propia rama, hay que crearla primero antes de implementar.

---

## Risks

1. **docker-compose.dev.yml tiene un app service roto** — si no se elimina o repara, `docker compose up` falla completamente, dejando al developer sin base de datos. Este es el riesgo inmediato.
2. **Rama incorrecta** — git está en `develop`, no en la rama feature de HU-1.2. Cualquier implementación accidentada afecta a develop directamente.
3. **Puerto 5432 ocupado** — si el developer ya tiene Postgres instalado localmente en el puerto 5432, docker-compose fallará con "port already allocated". El compose no tiene mecanismo de fallback.
4. **No hay seed automático** — `db:seed` corre con `npm run db:seed`, no está integrado en el docker-compose. El admin debe crearse manualmente o correr el seed después de levantar el contenedor.

---

## Ready for Proposal

**Sí, pero con caveats:**

1. El trabajo real de esta HU es **corregir/limpiar** el docker-compose.dev.yml existente, no crearlo de cero.
2. El scope es claro: Postgres reproducible para dev local con `npm run dev`.
3. Antes de proceder a PROPOSER, el equipo debe confirmar si Approach A (postgres-only) es aceptable o si quieren el enfoque 100% Docker (Approach B).
4. La discrepancia de rama debe resolverse — o bien se trabaja sobre `develop`, o bien se crea `feature/hu1-2-entorno-desarrollo-reproducible`.
