# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Jamas hacer commit ni push ni nada que tenga que ver con gir a menos de que el promt lo pida explicitamente.
Jamas arregles test a menos de que te lo pida explicitamente.

## What this is

vorTest — a Next.js dashboard for managing and running Playwright test automation. Users register test cases (uploaded scripts or recorded via a codegen-based recorder); execution itself happens in a separate sibling project, `../vortest-engine/` (NestJS), dispatched over RabbitMQ — see "Background execution" below. Results are captured as an "Acta" (PDF evidence report) with artifacts (video, screenshots, traces).

**This is one of two independent projects in this repo** (no shared workspace/tooling — each has its own `node_modules`/lockfile): this one (`vortest-web/`, the Next.js dashboard + API + DB) and `../vortest-engine/` (the Playwright execution engine). Root-level `docker-compose.dev.yml` (one level up) orchestrates both plus Postgres and RabbitMQ. See the root `README.md` for the two-project overview.

## Commands

```bash
docker compose -f ../docker-compose.dev.yml up postgres -d   # Postgres only, for local dev (compose lives at repo root)
npm run dev              # web (next dev --turbo) + execution-consumer + recorder-worker, concurrently
npm run dev:web          # Next.js only
npm run dev:consumer     # execution-consumer only (consumes RabbitMQ progress/result events from vortest-engine, writes to DB)
npm run dev:recorder     # recorder-worker only (codegen sessions)

npm run typecheck        # tsc --noEmit
npm run lint
npm test                 # jest (single file: npx jest path/to/file.test.ts)
npm run test:watch
npx playwright test       # e2e (requires the app running)

npm run db:migrate       # prisma migrate dev
npm run db:push          # schema push without a migration file
npm run db:seed          # seeds admin@admin.com / SEED_ADMIN_PASSWORD as superadmin
npm run db:studio
npm run db:reset         # ⚠️ drops all data
```

Non-interactive environments (CI, agents) cannot answer `prisma migrate dev`'s data-loss prompt. When that happens, hand-write the migration SQL under `prisma/migrations/<timestamp>_<name>/migration.sql` (or generate it with `prisma migrate diff --from-schema-datamodel <old> --to-schema-datamodel prisma/schema.prisma --script`, which needs no database), then apply with `prisma migrate deploy`. All migration folders are versioned (no `.gitignore` allow-list anymore).

Windows dev-server note: `next dev` (webpack) has shown intermittent ENOENT flakiness on `.next/server/**` on this machine; `dev`/`dev:web` already run with `--turbo` to avoid it. When starting a background dev server yourself, first check for already-running `node.exe` processes (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"` in PowerShell) — this repo's `npm run dev` spawns multiple node processes (web/worker/recorder), and `pkill` does not reliably match them on Windows; use `taskkill //PID <pid> //F` instead, and only against processes you started.

## Architecture

### Domain hierarchy
`Espacio` (workspace) → `Proyecto` (project) → `CasoPrueba` (test case) → `Ejecucion` (execution run, with `PasoEjecucion`/`PasoSubaccion` steps and `Artefacto` evidence files) → `Acta` (1:1 PDF report per execution). `Credencial` (encrypted secrets) belong to a `Proyecto` and are used by the recorder/runner, restricted to superadmin.

### RBAC (three roles, hierarchical scope)
- **superadmin**: full access; only role that can create/edit/delete `Espacio`s, manage `Credencial`es, or create `admin` users.
- **admin**: scoped to the `Espacio`s they're linked to via `UsuarioEspacio` (many-to-many, assigned only by superadmin). Full CRUD on `Proyecto`/`CasoPrueba`/`Ejecucion` within those espacios. Can create users but only as `tester`.
- **tester**: no access until assigned to a specific `Proyecto` via `UsuarioProyecto` (assigned by the admin of that proyecto's espacio, or superadmin). CRUD on `CasoPrueba`/`Ejecucion` only within assigned proyectos.

All authorization flows through `lib/auth.ts`:
- `getUsuarioActual(session)` — the single `{id, email, rol}` lookup; don't re-query this elsewhere.
- `requireSuperadmin` / `requireEspacioAdmin(session, espacioId)` / `requireProyectoAccess(session, proyectoId)` — throw `FORBIDDEN_ERROR` (or `NOT_FOUND_ERROR`), used as the first line of every mutating Server Action.
- `scopeEspacioWhere(usuario)` / `scopeProyectoWhere(usuario)` — Prisma `where` fragments for list queries, so unauthorized rows are filtered out server-side (never just hidden in the UI).

When adding a new mutating action or list query, follow this pattern: guard first (throw on failure), then scope reads with the `scope*Where` helpers — don't hand-roll role checks inline.

`getUsuarioActual` returns `null` for a session whose user was deleted **or deactivated** (`activo: false`). List helpers treat `usuario === null` as "deny" (empty list) and `undefined` as "internal, unscoped" — never pass a possibly-null user where unscoped data would leak. `withAuth` already rejects such sessions with 401; route handlers that don't use it must check `if (!usuario)` themselves, and must turn guard errors into responses with `mapErrorToResponse` (rethrowing `FORBIDDEN_ERROR` produces a 500). Pages that find no valid user redirect to `/api/logout` (clears the cookie), not `/login` — the middleware would bounce a cookie-holder off `/login` into an infinite redirect loop.

### App structure
- `app/(dashboard)/**` — authenticated pages (route group, session-gated by `middleware.ts`). Each resource typically has a server `page.tsx` (data fetching + guard) paired with a `*-client.tsx` client component for interactivity.
- `app/api/**` — REST-ish route handlers used by client components (e.g. `/api/usuarios`, `/api/grabador/sesiones`) and by the worker/recorder processes.
- `app/login`, `middleware.ts` — iron-session cookie auth (`vortest_session`); middleware redirects unauthenticated requests to `/login` and authenticated ones away from it. The middleware `matcher` must exclude any public static asset paths (e.g. `/icons`) or unauthenticated pages referencing them will get redirected.
- `lib/<domain>/actions.ts` — Server Actions per domain (`espacios`, `proyectos`, `casos`, `ejecuciones`, `usuarios`, `grabador`), each starting with an auth guard.
- `lib/db.ts` — shared Prisma client singleton.

### Background execution (feature/separacion-monolito: the actual Playwright engine moved out of this project)

- **The engine itself lives in `../vortest-engine/`** (separate NestJS project, own `node_modules`). It has ZERO database access. `dispararEjecucion` (`lib/ejecuciones/actions.ts`) publishes an `ExecuteJobMessage` built with `lib/ejecuciones/dispatch.ts::buildExecuteJob` (script text templated by `lib/worker/script-temp.ts::buildScriptText`: recorder storageState path stripped + `afterEach` storageState hook; there is no auto-repair anymore) to RabbitMQ queue `engine.execute`. The engine spawns `playwright test`, streams progress events (env/step/substep/log/assertion/captura-test/end) to `engine.events`, and uploads artifacts to `POST /api/internal/artefactos/upload` (guarded by `X-Internal-Secret` / `ENGINE_INTERNAL_SECRET`). The UI launches runs only through `lib/ejecuciones/use-lanzar-ejecucion.ts` → `POST /api/casos/[id]/ejecutar`.
- `scripts/execution-consumer.ts` (replaces the old `scripts/worker.ts`) — long-running process, own OS process like before, but **event-driven, not polling**: consumes `engine.events` from RabbitMQ and persists to `PasoEjecucion`/`PasoSubaccion`/`Ejecucion` (mirroring what `lib/worker/runner.ts` used to write directly — ported into `vortest-engine`; `lib/worker/{claim,lock,kill-tree,log-cap,storage-state,validate-script,auto-repair}.ts` still exist here only because their tests import them — no app code uses them). Also owns parent/child case chaining (publishes the child's job once it sees the parent's `end` event, using `Ejecucion.pendingChildEjecucionId` to survive the web-process/consumer-process boundary — this column is internal plumbing only, never exposed in the UI/API) and buffers `substep` events that arrive before their parent `step` row exists (single-consumer-instance assumption, same as the original worker).
- `lib/worker/artifacts.ts` now only contains the DB-linking half (`ensureArtefacto`, `linkCaptureToSubaccion(Auto)`, `linkCapturaTestToLastSubaccion`) — used by both the upload route and `execution-consumer.ts`. The file-scanning/hashing half lives in `vortest-engine`.
- `detenerEjecucion` (`lib/ejecuciones/actions.ts`) keeps its optimistic `estado: 'cancelado'` DB update, then also calls `POST {ENGINE_INTERNAL_URL}/internal/cancel/:ejecucionId` — a 404 there is a benign "this engine replica wasn't running that job," not an error.
- `scripts/recorder-worker.ts` + `lib/recorder/**` — **unchanged, unrelated to this refactor**: manages interactive Playwright Codegen sessions (`SesionGrabacion`) for the in-app recorder feature; `specCode` (raw codegen output) is the source of truth, `PasoGrabado` rows are a best-effort parse for display only, never used to regenerate the script. Talks to Postgres directly via Prisma (`lib/db.ts`), independent of the web process.
- When debugging "an execution doesn't start / doesn't progress," check (in order): is `docker compose`'s `rabbitmq` service healthy, is `vortest-engine` running and connected to it, is `scripts/execution-consumer.ts` (`npm run dev:consumer`) running — a stuck `Ejecucion` in `corriendo` almost always means one of these three isn't actually up, not a web-server issue.
- Known Fase-1 gap: no RabbitMQ dead-letter queue configured yet (infra config, not application code — flagged, not blocking).

### Testing
- Jest + Testing Library, `jsdom` environment, config via `next/jest` in `jest.config.mjs`.
- `iron-session` (ESM-only) and `@monaco-editor/react` are manually mocked (`__mocks__/`) because they don't work under jsdom/CJS Jest — reuse these mocks rather than adding new ad hoc ones.
- Playwright e2e specs live under `e2e/` and are excluded from the Jest run; they require the app to be running.

### Design system
Tokens live only in `app/tokens.css` (light + dark values, RGB channels) and `tailwind.config.ts` just exposes them as `m3-*` utilities (names in `lib/design-tokens.ts`). Brand: teal `m3-primary` #135C65, amber `m3-secondary-container` #EEAA0B. Use the base components in `components/ui/` (Button, Field/Input/Select, Alert, useToast, Modal with `hayCambios`, ConfirmDialog, EstadoBadge, Card, Tabs, Icon) and status labels from `lib/ejecuciones/estado.ts` ("Conforme / No conforme"); no raw hex colors or arbitrary text sizes. See `../docs/sistema-de-diseno.md`.
