# Tasks: HU-0.1 — Modelo de datos Prisma (HU-0.3 — Scaffold + primera migración)

> **PROSPECTIVAS**: Se aplican cuando se cree HU-0.3 (scaffold + primera migración) y corra su ciclo SDD completo. HU-0.1 solo entrega análisis/propuesta/spec/diseño/tasks.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~600 (scaffold + schema.prisma 224 + lib/prisma.ts + docker + .env + tests + .gitignore) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (scaffold + docker) → PR 2 (schema + init) → PR 3 (cliente + tests) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Scaffold Next.js + TS + docker postgres:16 | PR 1 | Base `feature/hu0-3-scaffold-next-prisma`. Sin Prisma. |
| 2 | `prisma/schema.prisma` 11 modelos + 3 enums + init | PR 2 | Base = PR 1. Verifica CA #1 y #3. |
| 3 | `lib/prisma.ts` singleton + tests 9 reqs | PR 3 | Base = PR 2. Verifica CA #2. |

## Phase 1: Foundation — PR 1

- [ ] 1.1 `package.json` (Next 14+ App Router, TS strict, dev/build/start/lint)
- [ ] 1.2 `tsconfig.json` (`strict`, paths `@/*` → `./*`)
- [ ] 1.3 `next.config.ts` (`output: "standalone"`)
- [ ] 1.4 `app/layout.tsx` (html lang="es")
- [ ] 1.5 `app/page.tsx` placeholder "ACTA — boot OK"
- [ ] 1.6 `docker-compose.dev.yml` (`postgres:16`, vol `pgdata_dev`, puerto 5432, healthcheck)
- [ ] 1.7 `.env.example` (`DATABASE_URL=postgresql://acta:acta_dev_password@localhost:5432/acta_dev?schema=public`)
- [ ] 1.8 `.gitignore` (`.env`, `node_modules/`, `.next/`, `coverage/`)
- [ ] 1.9 `lib/` con `.gitkeep`
- [ ] 1.10 `README.md` raíz: docker up + npm install + npm run dev

## Phase 2: Core schema — PR 2

- [ ] 2.1 `npm install @prisma/client` + `-D prisma`
- [ ] 2.2 `npx prisma init` (base descartable)
- [ ] 2.3 `prisma/schema.prisma` con Bloque 1 EXACTO del design.md
- [ ] 2.4 `.env` local con `DATABASE_URL` (NO commiteado)
- [ ] 2.5 Scripts npm: `db:generate/migrate/push/seed/studio/reset/validate`
- [ ] 2.6 `npx prisma migrate dev --name init` (genera `migration.sql` + `migration_lock.toml`)
- [ ] 2.7 CA #1: 11 tablas + 3 enums sin errores (inspección SQL)
- [ ] 2.8 CA #3: diff schema.prisma vs plan
- [ ] 2.9 `npx prisma validate`

## Phase 3: Cliente + tests + cleanup — PR 3

- [ ] 3.1 `lib/prisma.ts` con Bloque 2 EXACTO del design.md (singleton `globalThis`)
- [ ] 3.2 `npm install -D vitest @vitest/coverage-v8`
- [ ] 3.3 `vitest.config.ts` (paths, node)
- [ ] 3.4 `tests/schema/cascades.test.ts` — `DELETE FROM proyecto` con casos falla (R2)
- [ ] 3.5 `tests/schema/unique-acta.test.ts` — 2° `acta` mismo `ejecucionId` falla (R3)
- [ ] 3.6 `tests/schema/unique-codigo.test.ts` — 2° `casoPrueba` mismo `(proyectoId, codigo)` falla (R4)
- [ ] 3.7 `tests/schema/enum-ejecucion.test.ts` — estado fuera de enum falla (R7)
- [ ] 3.8 `tests/schema/responsable-not-null.test.ts` — `responsableId = NULL` falla (R6)
- [ ] 3.9 `tests/schema/timestamps.test.ts` — `createdAt`/`updatedAt` auto-fill; `activo` default `true` (R8)
- [ ] 3.10 `tests/schema/credencial-bytes.test.ts` — `valor` persiste como `\\x...` (R9)
- [ ] 3.11 `tests/integration/consecutivo-anual.test.ts` — 2 workers emiten `EJC-YYYY-NNNNNN` y `+1` sin colisión (R5)
- [ ] 3.12 `prisma/README.md` (migraciones, reset DB)
- [ ] 3.13 `npm run lint`, `npm run build`, `npx prisma validate` limpios

## Phase 4: Verificación final (pre-cierre HU-0.3)

- [ ] 4.1 `npm run db:reset` + `db:migrate` + `db:studio` (visual 11 tablas + 3 enums)
- [ ] 4.2 `npm test` (Phase 3 pasa)
- [ ] 4.3 Confirmar 3 CA: 4.3.1 migraciones sin errores; 4.3.2 FK Restrict evita huérfanos; 4.3.3 campos mínimos del plan

## Notes

- HU-0.1 NO implementa nada. Tareas para HU-0.3 (ciclo SDD 0 → 9).
- Orden PRs: PR 2 ↔ PR 1; PR 3 ↔ PR 2.
- 9 reqs: R1 (2.7–2.9), R2 (3.4), R3 (3.5), R4 (3.6), R5 (3.11), R6 (3.8), R7 (3.7), R8 (3.9), R9 (3.10).
