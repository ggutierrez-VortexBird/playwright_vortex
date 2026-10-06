# Proposal: HU-0.1 — Modelo de datos definido (Prisma)

## Intent

Definir analíticamente el esquema Prisma que dará soporte a la plataforma ACTA (ejecución de pruebas Playwright + generación de actas de evidencia). Esta HU-0.1 **no escribe `schema.prisma`** — solo cierra el "qué" y deja el "cómo" para una HU posterior de scaffolding del stack. El criterio de aceptación #1 de HU-0.1 ("cuando se corre la migración inicial…") queda como TODO pendiente hasta que se scaffoldee el proyecto Next.js + Prisma.

## Scope

### In Scope

- Decisión de los 10 ejes de modelo (naming, IDs, timestamps, enums, cascadas, 1-a-1 acta↔ejecución, consecutivos notariales, `versionSistema`, credenciales cifradas, sin Json libre).
- Contrato con `sdd-spec`: una capability nueva `modelo-de-datos-prisma` que cubre las 10 entidades + 1 tabla auxiliar + 3 enums.
- Especificación del ER (10 tablas + bridge + auxiliar) en el artefacto `spec.md` resultante.

### Out of Scope

- Crear `prisma/schema.prisma`, `prisma/migrations/`, `lib/db.ts`, `docker-compose.dev.yml`, `.env.example`.
- Implementar el generador de consecutivos (`SELECT FOR UPDATE`).
- Implementar el cifrado AES-GCM de credenciales (capa de aplicación, no de DB).
- Resolver las 5 preguntas abiertas del EXPLORER (ya respondidas en Checkpoint 1).
- Agregar `Json` libre o "metadatos de firma" al modelo `acta` (diferido a Fase 5).

## Capabilities

### New Capabilities

- `modelo-de-datos-prisma`: esquema completo de 10 entidades (`usuario`, `espacio`, `usuario_espacio`, `proyecto`, `caso_prueba`, `ejecucion`, `paso_ejecucion`, `artefacto`, `acta`, `credencial`) + tabla auxiliar `consecutivo_anual` + 3 enums nativos Postgres (`EjecucionEstado` con `errorMotor`, `PasoEjecucionEstado`, `ArtefactoTipo`). Cubre los criterios de aceptación de HU-0.1 y sienta las bases estructurales que consumen HU-1.1 a HU-7.3.

### Modified Capabilities

- Ninguna. `openspec/specs/` está vacío en MVP — esta es la primera capability del proyecto.

## Approach

Referencia explícita al approach recomendado en `explore/exploration.md`, ajustado por las decisiones del Checkpoint 1:

| Eje | Decisión |
|---|---|
| Naming | `camelCase` en DB (default Prisma, sin `@map`/`@@map`); modelos `PascalCase`, campos `camelCase` |
| IDs | `uuid` v4 nativo Postgres (`@default(uuid())`); ordenable vía `createdAt` |
| Postgres | `postgres:16` en `docker-compose.dev.yml` cuando se cree |
| Timestamps | `createdAt` + `updatedAt` en TODAS las tablas; hard delete; `activo: boolean` en `proyecto` y `caso_prueba` |
| Enums | Nativos Postgres; `EjecucionEstado` incluye `errorMotor` (HU-3.3) |
| Cascadas | `Restrict` en PKs de evidencia (`caso_prueba→proyecto`, `ejecucion→caso_prueba`, `acta→ejecucion`, `proyecto→espacio`, `credencial→proyecto`); `Cascade` en child rows (`paso_ejecucion→ejecucion`, `artefacto→ejecucion`, `usuario_espacio→*`) |
| Acta 1-a-1 | `UNIQUE(ejecucion_id)` + `Restrict`; regeneración con `UPDATE` |
| Consecutivos | `caso_prueba.codigo` UK por proyecto; `acta.consecutivo` UK global; tabla `consecutivo_anual(anio, ultimo)` con `SELECT FOR UPDATE` |
| `versionSistema` | `proyecto.versionSistema String?` (libre, opcional) |
| Credencial | `credencial.valor Bytes @db.ByteA` (cifrado AES-GCM en app) |
| Pasos | `paso_ejecucion` como tabla aparte (no `Json`) |
| Responsable | `caso_prueba.responsableId` FK obligatoria a `usuario.id` con `onDelete: Restrict`; tabla `usuario` se crea en la migración inicial |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | New | Modelo completo (10 entidades + auxiliar + 3 enums) — se crea en la HU de scaffolding |
| `prisma/migrations/<ts>_init/migration.sql` | New | DDL inicial; UKs, FKs y cascadas declaradas |
| `prisma/seed.ts` | New | Seed opcional del superusuario en dev (HU-1.1 lo completará semánticamente) |
| `lib/db.ts` | New | Singleton `PrismaClient` (patrón `globalForPrisma`) |
| `.env.example` | New | `DATABASE_URL` placeholder para `postgres:16` |
| `docker-compose.dev.yml` | New | Servicio `postgres:16` con volumen persistente |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| HU-0.1 no cierra criterio de aceptación #1 porque el stack no está instalado | High | Marcar criterio como TODO pendiente; crear HU posterior de scaffolding que ejecute la migración inicial |
| HU-3.3 introduce `errorMotor` no mencionado en el plan original | Medium | Ya incluido explícitamente en el enum `EjecucionEstado` desde la migración inicial (migración aditiva innecesaria) |

## Rollback Plan

Trivial — no hay código ni archivos de configuración modificados todavía. Si el usuario rechaza la propuesta, basta con borrar `openspec/changes/hu0-1-modelo-de-datos-prisma/` y resetear la rama `feature/hu0-1-modelo-de-datos-prisma` contra `develop`.

## Dependencies

Ninguna externa. No se instalan paquetes ni se ejecuta ningún comando en esta fase.

## Success Criteria

- [ ] Existe `proposal.md` con la capability `modelo-de-datos-prisma` declarada y aprobada por Checkpoint 1.
- [ ] `sdd-spec` genera `openspec/specs/modelo-de-datos-prisma/spec.md` cubriendo los 3 criterios de aceptación de HU-0.1 con escenarios Given/When/Then.
- [ ] `sdd-design` produce el diagrama ER final y `documentacion/convenciones-modelo-de-datos.md`.
- [ ] Cuando se scaffoldee el stack (HU posterior), existe `prisma/schema.prisma` con 10 modelos + 1 auxiliar + 3 enums.
- [ ] Existe `prisma/migrations/<timestamp>_init/migration.sql` con DDL completo (tablas, UKs, FKs, enums, cascadas explícitas).
- [ ] Existe `docker-compose.dev.yml` con servicio `postgres:16` y volumen persistente.
- [ ] Existe script `npm run db:migrate` documentado en `package.json`.
- [ ] La migración inicial corre sin errores y crea las 10 tablas (`prisma migrate dev` o `prisma migrate deploy`).
