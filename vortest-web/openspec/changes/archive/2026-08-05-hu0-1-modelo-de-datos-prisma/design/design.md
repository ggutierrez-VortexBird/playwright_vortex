# Design: HU-0.1 — Modelo de datos Prisma de ACTA

## Technical Approach

Este change define el **contrato único de verdad del modelo de datos** de ACTA: 11 tablas + 3 enums nativos Postgres en un único `prisma/schema.prisma`. La implementación se materializa en una **HU posterior de scaffolding** ("HU-0.3"), porque el stack aún no está instalado (ver `openspec/config.yaml → status: stack-planned-not-installed`). Cliente Prisma como **singleton** en `lib/prisma.ts` (patrón `globalForPrisma`), importado como `@/lib/prisma` desde RSC, Server Actions y el worker. **Migración inicial** con `prisma migrate dev --name init` (no `db push`), commiteada en `prisma/migrations/`. El **worker de Fase 3** del plan usa el mismo cliente y DB — single source of truth.

> **Alcance**: solo diseño. NO se crea `prisma/schema.prisma`, `lib/prisma.ts` ni `package.json` reales en este cambio.

## Architecture Decisions

### Decision: Ubicación de `schema.prisma` y convención del proyecto

**Choice**: `prisma/schema.prisma` en la raíz. Cliente default `node_modules/.prisma/client`. Singleton en `lib/prisma.ts`, importado como `@/lib/prisma`.
**Alternatives considered**: `src/prisma/schema.prisma` (requiere reconfigurar path); `db/schema.prisma` (choca con convención Prisma).
**Rationale**: Convención oficial Prisma + skill `nextjs-react-typescript` (kebab-case dirs, named exports). Mínimo surprise.

### Decision: Estrategia de generación de Prisma Client

**Choice**: Generator `prisma-client-js` (provider oficial), output default.
**Alternatives considered**: `prisma-client` (provider ESM nuevo en Prisma 5+, mejor tree-shaking pero requiere imports ESM y docs menos maduras).
**Rationale**: Máxima compatibilidad con docs/ecosystem. Migrar es trivial cuando convenga.

### Decision: Convención de naming DB **camelCase** (Checkpoint 1)

**Choice**: Modelo Prisma `PascalCase`, campos `camelCase`, columnas DB `camelCase`. **Sin** `@map`/`@@map`.
**Alternatives considered**: `snake_case` en DB vía `@map`/`@@map` (recomendación del explorer, rechazada por Checkpoint 1).
**Rationale**: Decisión binding del usuario. Reduce boilerplate, minimiza typos silenciosos, se alinea con la convención JS del stack.

### Decision: IDs `uuid` v4 (Checkpoint 1)

**Choice**: `id String @id @default(uuid())` en TODAS las entidades.
**Alternatives considered**: CUID v2, UUID v7, autoincrement Int.
**Rationale**: Decisión binding. UUID v4 es portable y suficiente porque ordenamos por `createdAt` cuando hace falta.

### Decision: Timestamps con `Timestamptz(6)`

**Choice**: `createdAt DateTime @default(now()) @db.Timestamptz(6)`, `updatedAt DateTime @updatedAt @db.Timestamptz(6)` en todas las tablas principales.
**Alternatives considered**: `Timestamp(3)` sin zona (pierde info multi-región); omitir `updatedAt` en tablas append-only.
**Rationale**: Timestamps con zona son default moderno. Para `pasoEjecucion` y `artefacto` (append-only), solo `createdAt` — `updatedAt` no aplica semánticamente.

### Decision: Cliente Prisma singleton con patrón `globalThis` en dev

**Choice**: `lib/prisma.ts` guarda el cliente en `globalThis` en dev para evitar agotar conexiones durante HMR.
**Alternatives considered**: Recrear cliente en cada import (rompe HMR y agota el pool).
**Rationale**: Patrón oficial documentado en `nextjs-developer/references/data-fetching.md`. Snippet en Bloque 2.

### Decision: Versionado de migraciones con `prisma migrate dev`

**Choice**: `prisma migrate dev` en dev → `<timestamp>_<slug>`. Migraciones commiteadas a `prisma/migrations/`. Prod: `prisma migrate deploy`.
**Alternatives considered**: `prisma db push` (sin migraciones versionadas — inaceptable: perdemos historial y rollback).
**Rationale**: CA #1 de HU-0.1 ("se corren las migraciones sin errores") implica que las migraciones existen. Versionadas son requisito para auditoría/rollback.

### Decision: Worker comparte cliente Prisma con la web

**Choice**: Worker (Fase 3 del plan) usa el MISMO `lib/prisma.ts`. No hay schema ni DB separados.
**Alternatives considered**: DB separada (complica ops, no aporta); cliente paralelo en `worker/db.ts` (duplica código).
**Rationale**: Single source of truth. Worker corre en el mismo contenedor en prod (`docker-compose.prod.yml`, sección 8 del plan).

### Decision: Variables de entorno y secretos

**Choice**: `.env.example` commiteado con `DATABASE_URL` placeholder. `.env` en `.gitignore`. Prisma lee `process.env.DATABASE_URL`.
**Alternatives considered**: Secrets de Docker (`/run/secrets/db_password`) — overkill para MVP.
**Rationale**: Dev-friendly. Prod sobreescribe con variables del orquestador (K8s secrets, ECS vars).

### Decision: Tabla puente `usuarioEspacio` con PK compuesta

**Choice**: `@@id([usuarioId, espacioId])`.
**Alternatives considered**: Surrogate `id` autoincrement + UK compuesta (más columnas, más joins).
**Rationale**: PK compuesta es idiomática para tablas puente N-a-N; impide duplicados a nivel DB.

## Data Flow

```
                    ┌──────────────────────────┐
                    │  Next.js App (RSC + API) │
                    └────────────┬─────────────┘
                                 │ importa @/lib/prisma
                                 ▼
                         ┌──────────────┐
                         │ lib/prisma.ts│ (singleton)
                         └──────┬───────┘
                                │ Prisma Client
                                ▼
                    ┌───────────────────────────┐
                    │  Postgres 16 (Docker dev) │
                    │  11 tablas + 3 enums      │
                    └───────────────────────────┘
                                ▲
                                │ Prisma Client
                         ┌──────┴───────┐
                         │ Worker (Fase 3) │
                         └──────────────────┘
```

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/schema.prisma` | Create (HU-0.3) | Schema Prisma con 11 modelos + 3 enums (Bloque 1 abajo). |
| `prisma/migrations/20260805120000_init/migration.sql` | Create (HU-0.3) | Migración inicial (`prisma migrate dev --name init`). |
| `prisma/migrations/migration_lock.toml` | Create (HU-0.3) | Lockfile provider (postgresql). |
| `lib/prisma.ts` | Create (HU-0.3) | Cliente singleton con `globalThis` (Bloque 2). |
| `.env.example` | Create (HU-0.3) | Template `DATABASE_URL`. |
| `.env` | Create local | Conexión real a Postgres local (no commiteado). |
| `.gitignore` | Modify (HU-0.3) | Agregar `.env`. |
| `package.json` | Modify (HU-0.3) | Deps + scripts del Bloque 3. |
| `docker-compose.dev.yml` | Create (HU-0.3) | Solo `postgres:16` con volumen persistente. |
| `design/design.md` | Create (ESTE archivo) | Este doc. |

## Interfaces / Contracts

### Bloque 1 — `prisma/schema.prisma` (texto completo)

```prisma
// ACTA — Prisma schema
// HU-0.1: 11 tablas + 3 enums. Naming camelCase en DB. UUID v4. Postgres 16+.
// Convenciones: Restrict en PKs de evidencia; Cascade en child rows.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// Enums nativos Postgres
// ============================================================

enum EjecucionEstado {
  pendiente
  corriendo
  paso
  fallo
  reparado
  errorMotor     // HU-3.3: distingue "falló la prueba" de "falló el motor"
}

enum PasoEjecucionEstado {
  paso
  fallo
  reparado
}

enum ArtefactoTipo {
  video
  captura
  trace
}

// ============================================================
// Entidades de identidad y membresía (HU-1.1, HU-6.1)
// ============================================================

model Usuario {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  rol          String   @default("superadmin")
  createdAt    DateTime @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime @updatedAt @db.Timestamptz(6)

  espacios        UsuarioEspacio[]
  casosAsignados  CasoPrueba[]    @relation("CasoPruebaResponsable")

  @@index([email])
}

model Espacio {
  id        String   @id @default(uuid())
  nombre    String
  color     String
  activo    Boolean  @default(true)
  createdAt DateTime @default(now()) @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @db.Timestamptz(6)

  proyectos Proyecto[]
  miembros  UsuarioEspacio[]
}

model UsuarioEspacio {
  usuarioId  String
  espacioId  String
  createdAt  DateTime @default(now()) @db.Timestamptz(6)

  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)
  espacio Espacio @relation(fields: [espacioId], references: [id], onDelete: Cascade)

  @@id([usuarioId, espacioId])
  @@index([espacioId])
}

// ============================================================
// Jerarquía espacio → proyecto → caso de prueba (HU-2.x)
// ============================================================

model Proyecto {
  id             String   @id @default(uuid())
  espacioId      String
  nombre         String
  ambiente       String
  descripcion    String?
  versionSistema String?  // HU-5.1: libre, opcional (meta-grid del acta)
  activo         Boolean  @default(true)
  createdAt      DateTime @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime @updatedAt @db.Timestamptz(6)

  espacio     Espacio       @relation(fields: [espacioId], references: [id], onDelete: Restrict)
  casosPrueba CasoPrueba[]
  credenciales Credencial[]

  @@index([espacioId])
}

model CasoPrueba {
  id            String   @id @default(uuid())
  proyectoId    String
  codigo        String   // CP-XXXX-YY, único por proyecto
  nombre        String
  rutaScript    String
  responsableId String   // FK obligatoria a usuario.id (HU-1.1)
  activo        Boolean  @default(true)
  createdAt     DateTime @default(now()) @db.Timestamptz(6)
  updatedAt     DateTime @updatedAt @db.Timestamptz(6)

  proyecto    Proyecto  @relation(fields: [proyectoId], references: [id], onDelete: Restrict)
  responsable Usuario   @relation("CasoPruebaResponsable", fields: [responsableId], references: [id], onDelete: Restrict)
  ejecuciones Ejecucion[]

  @@unique([proyectoId, codigo])   // HU-2.3: UK por proyecto
  @@index([responsableId])
  @@index([proyectoId])
}

// ============================================================
// Ejecución, pasos, artefactos (HU-3.x, HU-4.x)
// ============================================================

model Ejecucion {
  id           String          @id @default(uuid())
  casoPruebaId String
  estado       EjecucionEstado
  inicioAt     DateTime?
  finAt        DateTime?
  duracionMs   Int?
  createdAt    DateTime        @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime        @updatedAt @db.Timestamptz(6)

  casoPrueba CasoPrueba      @relation(fields: [casoPruebaId], references: [id], onDelete: Restrict)
  pasos      PasoEjecucion[]
  artefactos Artefacto[]
  acta       Acta?

  @@index([casoPruebaId])
  @@index([estado])            // worker poll: WHERE estado IN ('pendiente')
}

model PasoEjecucion {
  id          String              @id @default(uuid())
  ejecucionId String
  numero      Int
  descripcion String
  estado      PasoEjecucionEstado
  duracionMs  Int?
  selfHealed  Boolean             @default(false)   // HU-4.3
  errorMsg    String?
  createdAt   DateTime            @default(now()) @db.Timestamptz(6)

  ejecucion Ejecucion @relation(fields: [ejecucionId], references: [id], onDelete: Cascade)

  @@unique([ejecucionId, numero]) // orden estable por ejecución
  @@index([ejecucionId])
}

model Artefacto {
  id          String        @id @default(uuid())
  ejecucionId String
  tipo        ArtefactoTipo
  path        String        // ruta en volumen persistente
  sha256      String        // integridad (HU-5.1)
  bytes       Int
  createdAt   DateTime      @default(now()) @db.Timestamptz(6)

  ejecucion Ejecucion @relation(fields: [ejecucionId], references: [id], onDelete: Cascade)

  @@index([ejecucionId])
  @@index([tipo])
}

// ============================================================
// Acta de evidencia (HU-5.x) — 1-a-1 con ejecución
// ============================================================

model Acta {
  id           String    @id @default(uuid())
  ejecucionId  String    @unique                  // enforza 1-a-1 con Ejecucion
  consecutivo  String    @unique                  // EJC-YYYY-NNNNNN, UK global
  rutaPdf      String
  generatedAt  DateTime?
  createdAt    DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt    DateTime  @updatedAt @db.Timestamptz(6)
  // NO metadatos de firma (diferido a Fase 5 / HU-5.x posterior)

  ejecucion Ejecucion @relation(fields: [ejecucionId], references: [id], onDelete: Restrict)
}

// ============================================================
// Credenciales (HU-7.x) — prioridad baja
// ============================================================

model Credencial {
  id             String    @id @default(uuid())
  proyectoId     String
  nombre         String
  tipo           String    // HU-7.1 lo promueve a enum en migración aditiva
  valor          Bytes     @db.ByteA     // AES-GCM cifrado en app
  sesionVenceAt  DateTime?
  createdAt      DateTime  @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @db.Timestamptz(6)

  proyecto Proyecto @relation(fields: [proyectoId], references: [id], onDelete: Restrict)

  @@index([proyectoId])
}

// ============================================================
// Tabla auxiliar — correlativo anual atómico (HU-5.3)
// ============================================================

model ConsecutivoAnual {
  anio   Int @id
  ultimo Int
}
```

### Bloque 2 — `lib/prisma.ts` (snippet)

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Bloque 3 — Scripts npm en `package.json`

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "db:reset": "prisma migrate reset"
  }
}
```

## Testing Strategy

> Sin stack instalado todavía — esta sección documenta la **estrategia**; implementación llega en HU-0.3.

| Layer | What to Test | Approach | When |
|---|---|---|---|
| Schema validation | `schema.prisma` compila + `migrate dev --name init` sin errores (CA #1) | Script `db:validate` en CI | HU-0.3 |
| Unit | Formateo `CP-XXXX-YY` / `EJC-YYYY-NNNNNN`; validación regex | Vitest | HU-0.3 |
| Integration | Cascade behavior: borrar `proyecto` con casos falla (Restrict); borrar `ejecucion` borra pasos/artefactos; `acta.ejecucionId` duplicado falla (UK) | Vitest + Postgres efímero | HU-0.3 |
| Integration | `consecutivoAnual`: 2 workers concurrentes emiten consecutivos distintos sin race (CA #5.3) | Vitest + 2 workers | HU-5.3 |
| E2E (futuro) | Flujos completos de HUs (login, crear espacio, etc.) | Playwright (producto) | Cada HU |

## Migration / Rollout

- **No hay código** todavía — no hay rollout para HU-0.1.
- Rollout real en HU-0.3 (sugerida: scaffold + primera migración): scaffoldea Next.js (App Router, TS strict), instala `@prisma/client` + `prisma` + scripts, crea `prisma/schema.prisma` (Bloque 1), crea `lib/prisma.ts` (Bloque 2), crea `docker-compose.dev.yml` con `postgres:16`, corre `npx prisma migrate dev --name init`, verifica los 3 CA de HU-0.1.
- **Rollback**: borrar `prisma/`, `lib/prisma.ts`, revertir `package.json`; `docker compose down -v` borra la DB.

## Open Questions

- ¿`casoPrueba.descripcion` libre desde el inicio? **Default: NO** (no en spec).
- ¿`acta.rutaPdf` admite múltiples PDFs (histórico)? **Default: NO** — se sobrescribe en cada `UPDATE`.
- ¿`credencial.tipo` enum o string libre? **Default: string libre**; enum aditivo en HU-7.1.
- ¿`Proyecto.descripcion` con longitud máxima? **Default: NO** — Zod en UI si hace falta.