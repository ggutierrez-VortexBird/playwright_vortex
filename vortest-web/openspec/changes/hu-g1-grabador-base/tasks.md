# Tasks: Iniciar sesión de grabación (HU-G1 + HU-G21 + HU-G22)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1800 (schema + recorder-worker + UI + tests + spec deltas) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes (per plan_ejecucion_hus.md D1=400 lines) |
| Suggested split | PR-A (Phase 1+2: schema + recorder-worker + credenciales) → PR-B (Phase 3+4: UI + tests + e2e) |
| Delivery strategy | auto-chain (resolved from plan_ejecucion_hus.md: ask-on-risk + chained decision) |
| Chain strategy | feature-branch-chain |

Decision needed before apply: **Yes** (apply will request 2 chained PRs: backend first, then UI)

> **Nota**: para mantener un demo indivisible (PR-2 del plan consolidado) en este PR único, vamos a aplicar todo en una sola feature branch `feature/hu-g1-grabador-base` y squash-mergear a `develop-fase2`. El split en chained PRs queda documentado como **plan alternativo** si la revisión lo prefiere. El decision needed before apply queda **Yes** para que el usuario elija.

## Phase 1: Schema + Capa base (HU-G21)

- [ ] 1.1 Agregar `enum CasoOrigen { subirScript, grabador, mixto }` a `playwright_vortex/prisma/schema.prisma`
- [ ] 1.2 Agregar `model SesionGrabacion` (campos + índices + `@@index([estado])`)
- [ ] 1.3 Agregar `model PasoGrabado` (con `@@unique([sesionId, numero])` + cascade)
- [ ] 1.4 Agregar `model ParametroGrabacion` (con `@@unique([sesionId, nombre])`)
- [ ] 1.5 Agregar `model JuegoDeDatos` (con cascade)
- [ ] 1.6 Extender `CasoPrueba` con `origen CasoOrigen @default(subirScript)` + back-relations
- [ ] 1.7 Extender `Ejecucion` con `loteId String?`
- [ ] 1.8 Extender `PasoEjecucion` con `videoInicioMs Int?`, `videoFinMs Int?`
- [ ] 1.9 Correr `npx prisma migrate dev --name hu_g21_grabador_models` y validar que aplica limpia
- [ ] 1.10 Validar que casos pre-existentes quedan con `origen='subirScript'` (query de smoke)

## Phase 2: Recorder-worker + Credenciales (HU-G22)

- [ ] 2.1 Crear `playwright_vortex/lib/credenciales/crypto.ts` con `encryptCredencial` / `decryptCredencial` (AES-256-GCM + scrypt con SESSION_SECRET)
- [ ] 2.2 Crear `playwright_vortex/lib/credenciales/decrypt.ts` (helper JSON parseado)
- [ ] 2.3 Crear `playwright_vortex/lib/credenciales/seed.ts` (idempotente, crea 1 credencial demo)
- [ ] 2.4 Modificar `playwright_vortex/prisma/seed.ts` para llamar `seedCredencialDemo` al final
- [ ] 2.5 Crear `playwright_vortex/lib/recorder/types.ts` (SessionEntry, WsClientMessage, WsServerMessage)
- [ ] 2.6 Crear `playwright_vortex/lib/recorder/auth.ts` (`issueToken`, `validateToken` con HMAC-SHA256 + SESSION_SECRET)
- [ ] 2.7 Crear `playwright_vortex/lib/recorder/session-registry.ts` (Map + locks + MAX_SESSIONS enforcement + cleanup de huérfanos)
- [ ] 2.8 Crear `playwright_vortex/lib/recorder/launch-session.ts` (`launchPersistentContext` + storageState + `page.exposeFunction('__pw_report')` + `page.addInitScript` con listeners DOM stub)
- [ ] 2.9 Crear `playwright_vortex/lib/recorder/screencast.ts` (CDP `Page.startScreencast` + handler de `Page.screencastFrame`)
- [ ] 2.10 Crear `playwright_vortex/lib/recorder/http-api.ts` (Node `http` server con `POST /internal/start` + `GET /health`)
- [ ] 2.11 Crear `playwright_vortex/lib/recorder/ws-server.ts` (ws.Server con handshake por token + broadcast)
- [ ] 2.12 Crear `playwright_vortex/scripts/recorder-worker.ts` (entrypoint: startup orphan-cleanup + http-api + ws-server)
- [ ] 2.13 Agregar `"ws": "^8.18.0"` a `playwright_vortex/package.json` dependencies
- [ ] 2.14 Modificar script `dev` en `package.json`: `concurrently -k -n web,worker,recorder -c blue,magenta,green "next dev" "node --import tsx scripts/worker.ts" "node --import tsx scripts/recorder-worker.ts"`
- [ ] 2.15 Agregar env vars a `playwright_vortex/.env.example`: `RECORDER_WS_PORT`, `RECORDER_PUBLIC_URL`, `RECORDER_INTERNAL_SECRET`, `RECORDER_MAX_SESSIONS`, `RECORDER_HEARTBEAT_TIMEOUT_MS`
- [ ] 2.16 Modificar `playwright_vortex/docker-compose.dev.yml`: agregar servicio `recorder` (imagen acta-dev, command recorder-worker, port 3100, volúmenes compartidos)

## Phase 3: API + Frontend (HU-G1)

- [ ] 3.1 Crear `playwright_vortex/app/api/proyectos/[id]/credenciales/route.ts` (GET, retorna lista sin `valor`)
- [ ] 3.2 Crear `playwright_vortex/lib/grabador/types.ts` (NuevaGrabacionInput, SesionGrabacionOut)
- [ ] 3.3 Crear `playwright_vortex/lib/grabador/recorder-client.ts` (HTTP client hacia `/internal/start` con `X-Internal-Secret`)
- [ ] 3.4 Crear `playwright_vortex/lib/grabador/actions.ts` (`iniciarSesionGrabacion` Server Action: auth + validar + crear SesionGrabacion + llamar recorder + guardar token)
- [ ] 3.5 Crear `playwright_vortex/app/api/grabador/sesiones/route.ts` (POST wrapper que invoca la Server Action)
- [ ] 3.6 Crear `playwright_vortex/app/api/grabador/sesiones/[id]/route.ts` (GET estado)
- [ ] 3.7 Modificar `playwright_vortex/components/casos/casos-client.tsx`: agregar botón "Grabar caso" al lado de "+ Nuevo Caso"
- [ ] 3.8 Modificar `playwright_vortex/app/(dashboard)/proyectos/[id]/casos/page.tsx`: agregar botón "Grabar caso" en topbar (link a `/casos/grabar/nueva?proyectoId=…`)
- [ ] 3.9 Crear `playwright_vortex/components/grabador/nueva-grabacion-form.tsx` (form con useActionState, validación client-side de URL)
- [ ] 3.10 Crear `playwright_vortex/app/(dashboard)/casos/grabar/nueva/page.tsx` (Server Component que carga credenciales y monta el form)
- [ ] 3.11 Crear `playwright_vortex/app/(dashboard)/casos/grabar/[sesionId]/page.tsx` (Server Component que valida propiedad de sesión y monta `<GrabadorClient>`)
- [ ] 3.12 Crear `playwright_vortex/app/(dashboard)/casos/grabar/[sesionId]/loading.tsx`
- [ ] 3.13 Crear `playwright_vortex/app/(dashboard)/casos/grabar/[sesionId]/error.tsx` (acepta `searchParams.reason`)
- [ ] 3.14 Crear `playwright_vortex/components/grabador/grabador-client.tsx` (useState/useEffect para WS, canvas ref, reconnect backoff, heartbeat interval)
- [ ] 3.15 Crear `playwright_vortex/components/grabador/screencast-canvas.tsx` (renderiza frame JPEG en canvas con requestAnimationFrame)
- [ ] 3.16 Crear `playwright_vortex/components/grabador/connection-status.tsx` (badge con pulso CSS por estado)
- [ ] 3.17 Crear `playwright_vortex/components/grabador/url-bar.tsx` (lee page.url desde evento WS)
- [ ] 3.18 Crear `playwright_vortex/components/grabador/paso-panel.tsx` (panel derecho, vacío en G1 con sello `.stamp`)
- [ ] 3.19 Crear `playwright_vortex/components/grabador/rec-toolbar.tsx` (4 botones disabled, comentarios "wired en HU-G5..G7")
- [ ] 3.20 Agregar estilos a `playwright_vortex/app/globals.css`: `.vp-chrome`, `.vp-stage`, `.vp-toolbar`, `.rec-badge`, `@keyframes rec-pulse`

## Phase 4: Tests + Verificación

- [ ] 4.1 Test unit `__tests__/lib/recorder/auth.test.ts` (issue/validate/expiración/replay)
- [ ] 4.2 Test unit `__tests__/lib/recorder/session-registry.test.ts` (add/remove/limit/cleanup)
- [ ] 4.3 Test unit `__tests__/lib/credenciales/crypto.test.ts` (round-trip, nonce único)
- [ ] 4.4 Test unit `__tests__/lib/grabador/actions.test.ts` (mock recorder HTTP, validar orchestration)
- [ ] 4.5 Test integration `__tests__/api/grabador/sesiones.test.ts` (401 sin sesión, 400 credencial inválida, 201 OK con token)
- [ ] 4.6 Test integration `__tests__/api/proyectos/[id]/credenciales.test.ts` (401 sin sesión, 200 sin `valor`)
- [ ] 4.7 Test integration recorder-worker lifecycle (spawn worker en puerto random, crear sesión, WS handshake)
- [ ] 4.8 E2E `e2e/grabador-iniciar.spec.ts` (login → /casos/grabar/nueva → form → click → badge EN VIVO <5s)
- [ ] 4.9 E2E `e2e/grabador-url-inaccesible.spec.ts` (URL `http://localhost:1` → error.tsx en <12s)
- [ ] 4.10 Correr `npm run lint`, `npm run typecheck`, `npm run test` (Jest), `npx playwright test e2e/grabador-*.spec.ts`
- [ ] 4.11 Validar manualmente con el dev server (`npm run dev`) el escenario completo

## Phase 5: Cierre

- [ ] 5.1 Generar commits con `work-unit-commits` (un commit por phase lógico, mensajes en español)
- [ ] 5.2 Squash-merge de `feature/hu-g1-grabador-base` a `develop-fase2`
- [ ] 5.3 Push de `develop-fase2` al remoto (si existe)
- [ ] 5.4 Confirmar working tree limpio en `develop-fase2`
- [ ] 5.5 Llenar `verify-report.md` con resultados de REVISAR
- [ ] 5.6 (Opcional) `sdd-archive` para mover el change al directorio `archive/`

---

## Notas de orden de implementación

**Orden recomendado (respetando dependencias técnicas):**

1. **Phase 1** completa (schema migrado) ANTES de Phase 2 — el recorder-worker lee/escribe `SesionGrabacion`.
2. **Phase 2.1-2.4** (credenciales) ANTES de Phase 2.5+ (recorder) — el recorder necesita descifrar `Credencial.valor`.
3. **Phase 2.13-2.14** (agregar `ws` + script dev) ANTES de Phase 2.15-2.16 (env vars + docker) — primero el código, después la plomería.
4. **Phase 3.1-3.6** (API + actions) ANTES de Phase 3.7-3.20 (UI) — la UI consume los endpoints.
5. **Phase 4** corre al final, en paralelo con implementación manual.
6. **Phase 5** solo después del MANUAL GATE.

**Work-unit commits** (sugerencia de agrupación por commit, no por phase completa):

- Commit 1: `feat(schema): agregar modelos del grabador (HU-G21)` — solo Phase 1
- Commit 2: `feat(credenciales): crypto AES-256-GCM + seed demo` — Phase 2.1-2.4
- Commit 3: `feat(recorder): worker process + auth HMAC + registry` — Phase 2.5-2.12
- Commit 4: `chore(dev): ws dependency + concurrently + docker compose + env vars` — Phase 2.13-2.16
- Commit 5: `feat(api): endpoints grabador + credenciales` — Phase 3.1-3.6
- Commit 6: `feat(ui): modo grabador — form + vista EN VIVO + WS client` — Phase 3.7-3.20
- Commit 7: `test(grabador): unit + integration + e2e` — Phase 4
- Commit 8 (o parte de 7): `docs(specs): deltas para gestion-casos-prueba + modelo-de-datos-prisma + modo-grabador`