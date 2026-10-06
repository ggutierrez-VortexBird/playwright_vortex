# Proposal: Iniciar sesión de grabación (HU-G1 + HU-G21 + HU-G22)

## Intent

Habilitar el **modo grabador** de ACTA: el usuario puede iniciar una grabación contra una URL objetivo desde la UI, ver la página objetivo en vivo dentro de la app (browser-streaming vía WebSocket), y mantener un ciclo de vida de sesión que persiste cada paso en DB. Este cambio entrega el **PR-2 del plan consolidado** (`fase2/ACTA-Plan-Consolidado-Grabador.md`) en una sola feature branch, consolidando los fundamentos de schema (HU-G21) y el recorder-worker (HU-G22) con la feature de usuario (HU-G1) porque las tres forman un demo indivisible: sin schema no hay fila, sin worker no hay browser, sin UI no hay trigger.

## Scope

### In Scope

**HU-G21 — Migración Prisma (no-breaking)**
- 4 modelos nuevos: `SesionGrabacion`, `PasoGrabado`, `ParametroGrabacion`, `JuegoDeDatos`.
- 1 enum nuevo: `CasoOrigen { subirScript, grabador, mixto }`.
- Extensión de `CasoPrueba`: campo `origen CasoOrigen @default(subirScript)` + back-relations.
- Extensión de `Ejecucion`: campo nullable `loteId String?` (HU-G13 data-driven, stub).
- Extensión de `PasoEjecucion`: campos nullable `videoInicioMs Int?`, `videoFinMs Int?` (HU-G18, stub).
- Todas las columnas nuevas con `@default` o nullable → casos pre-existentes mantienen `origen='subirScript'` y siguen funcionando.

**HU-G22 — Recorder-worker (proceso Node dedicado)**
- Nuevo proceso `playwright_vortex/scripts/recorder-worker.ts` que combina:
  - HTTP API interna (`POST /internal/start`, `GET /health`) autenticada con `X-Internal-Secret`.
  - WebSocket server (`ws://RECORDER_PUBLIC_URL`) autenticado con token HMAC de un solo uso.
  - Sesión registry en memoria: `Map<sessionId, SessionEntry>`.
  - Lógica de lifecycle: launch Chromium persistente → goto URL → start CDP screencast → reenviar frames por WS → heartbeat → expiración.
- Helpers en `playwright_vortex/lib/recorder/`:
  - `auth.ts`: `issueToken(sessionId, userId)`, `validateToken(token)`.
  - `session-registry.ts`: add/remove/get con lock por sessionId + enforcement de `RECORDER_MAX_SESSIONS`.
  - `launch-session.ts`: `chromium.launchPersistentContext({ headless: true, args: [...] })` + storageState precargado + `page.exposeFunction('__pw_report')` + `page.addInitScript` con listeners DOM.
  - `screencast.ts`: `cdp.send('Page.startScreencast', { format:'jpeg', quality:80, everyNthFrame:1 })` y reenvío de `Page.screencastFrame` al WS.
  - `http-api.ts`: servidor HTTP nativo con handlers `/internal/start` y `/health`.
  - `ws-server.ts`: servidor `ws` con handshake por token y broadcast por sessionId.
- Agregar `ws ^8.18.0` a `dependencies`.
- Plomería dev: extender `package.json` script `dev` con `concurrently` para incluir el recorder.
- Plomería docker: agregar servicio `recorder` en `playwright_vortex/docker-compose.dev.yml`.
- Nuevas env vars en `.env.example`: `RECORDER_WS_PORT`, `RECORDER_PUBLIC_URL`, `RECORDER_INTERNAL_SECRET`, `RECORDER_MAX_SESSIONS`, `RECORDER_HEARTBEAT_TIMEOUT_MS`.

**HU-G22.b — Credenciales: crypto + API mínimo de lectura**
- `playwright_vortex/lib/credenciales/crypto.ts`: AES-256-GCM con key derivada de `SESSION_SECRET` (vía `scrypt`) — encrypt/decrypt de `Credencial.valor`.
- `playwright_vortex/lib/credenciales/decrypt.ts`: helper que descifra server-side.
- `playwright_vortex/lib/credenciales/seed.ts`: crea 1 `Credencial` de muestra con storageState mínimo (origen `about:blank`) para que el demo funcione out-of-the-box.
- `playwright_vortex/app/api/proyectos/[id]/credenciales/route.ts`: `GET` que devuelve `[{id, nombre, tipo, vence}]` (nunca devuelve `valor`).

**HU-G1 — UI + endpoint "Iniciar sesión de grabación"**
- Botón "Grabar caso" en `app/(dashboard)/casos/casos-client.tsx` y `app/(dashboard)/proyectos/[id]/casos/page.tsx`, al lado de "+ Nuevo Caso" (sin ser un mode selector formal — eso es HU-G20 en PR-4).
- Página `app/(dashboard)/casos/grabar/nueva/page.tsx`: form con `nombre`, `urlInicial`, `ambiente` (select), `credencialId` (select poblado desde la nueva API), `navegador` (radio; MVP solo `chromium` activo).
- Página `app/(dashboard)/casos/grabar/[sesionId]/page.tsx`: vista "EN VIVO" que monta `<GrabadorClient>`.
- `components/grabador/grabador-client.tsx`: Client Component que abre WS, pinta frames en `<canvas>`, maneja reconexión con backoff 1-5s, expone panel de pasos (vacío en G1; populated en G3) y toolbar inferior (botones visuales, lógica en HUs siguientes).
- `components/grabador/screencast-canvas.tsx`, `paso-panel.tsx`, `rec-toolbar.tsx`, `connection-status.tsx`, `url-bar.tsx`: sub-componentes del cliente.
- `app/(dashboard)/casos/grabar/[sesionId]/error.tsx` y `loading.tsx`: boundaries del segmento.
- Endpoint `app/api/grabador/sesiones/route.ts` (POST): valida auth, valida campos, descifra credencial, llama `recorder-worker /internal/start`, persiste `SesionGrabacion` con token, devuelve `{sessionId, wsUrl, token}`.
- Endpoint `app/api/grabador/sesiones/[id]/route.ts` (GET): devuelve estado actual de la sesión (para rehidratación post-refresh).
- Server Action `lib/grabador/actions.ts`: `iniciarSesionGrabacion(input, session)` que orquesta el flujo.
- Manejo de error: si `page.goto` falla en el worker, sesión queda `estado='error'` y frontend recibe `{type:'error', msg}` por WS.

### Out of Scope

- Señalar elemento (HU-G5), Agregar verificación (HU-G6), Convertir en parámetro + Pausar funcional (HU-G7).
- Parser código↔pasos bidireccional — MVP solo pasos→código (HU-G11 serialize); parser inverso en PR-6.
- Editor / Revisar caso / Reanudar (HU-G8/G9/G10/GR-2).
- CRUD de credenciales (alta/baja/renovación) — la página `/credenciales` sigue siendo placeholder; solo agregamos el GET de lectura para que el dropdown tenga opciones.
- Selector de modo unificado (HU-G20, PR-4) — el botón "Grabar caso" coexiste con "+ Nuevo Caso" hasta HU-G20.
- Multi-navegador (Firefox/WebKit).
- Auto-guardado y recuperación tras crash (HU-GR-1, PR-6).
- Xvfb (vamos 100% headless con CDP screencast; no se necesita display server).
- Spikes comparativos (PR-0) — se asume CDP screencast directo como decisión arquitectónica.

## Capabilities

### New Capabilities

- **`modo-grabador`**: ciclo de vida de sesiones de grabación (crear → activa → detenida/descartada/error), live-streaming de browser vía WebSocket, autenticación HMAC por token, integración con `Credencial` para precargar `storageState`.

### Modified Capabilities

- **`gestion-casos-prueba`**: el caso de prueba ahora puede originarse por grabación (`origen='grabador'`) además del flujo actual de subida de script. El campo es nullable/default → no rompe nada.
- **`modelo-de-datos-prisma`**: 4 modelos nuevos + extensiones a 3 modelos existentes (todas no-breaking).
- **`gestion-credenciales`** (implícito, no estaba formalizado como spec): la `Credencial` ahora se consulta de forma segura (sin exponer `valor` cifrado) y se usa como fuente de `storageState` para Chromium persistente.

## Approach

Tres capas con dependencias estrictas:

1. **Capa 1 — Schema & credenciales**: `prisma migrate dev` aplica 4 modelos nuevos + extensiones. Credenciales pasan a tener `valor` cifrado con AES-256-GCM. Seed crea 1 credencial de muestra.
2. **Capa 2 — Recorder-worker**: proceso Node standalone que levanta HTTP API + WS. Reusa el patrón de `scripts/worker.ts` (long-lived, polling liviano) pero la lógica es por evento (no polling). Browser persistent con `launchPersistentContext` + `storageState` + `addInitScript` con listeners DOM (stubs en G1 — los listeners solo exponen `__pw_report` que G1 deja sin uso; G3 los cablea).
3. **Capa 3 — UI + API Next.js**: página "Nueva grabación" → POST `/api/grabador/sesiones` → recibe token → abre WS al recorder → renderiza `<canvas>` con frames + panel de pasos (vacío) + estado "EN VIVO".

Concurrencia: el recorder-worker mantiene sesiones con heartbeat (10 min timeout). Límite configurable `RECORDER_MAX_SESSIONS` (default 3). Al alcanzar el límite → 503 claro.

Auth de WS: HMAC-SHA256 con `SESSION_SECRET` (mismo secret que `iron-session`). Token de un solo uso: al validar se marca `tokenUsado=true` en DB; segunda conexión con mismo token → rechazo.

Decisión de live-stream: **CDP `Page.startScreencast` directo**, sin Xvfb, sin noVNC, sin MJPEG. Comprometemos esta arquitectura en este PR; si la latencia duele en producción, swap a `Page.captureScreenshot` bajo demanda (decisión diferida para HU-G18).

Mockup de referencia visual: **`fase2/mockups/grabar-test.html`** (Material Symbols + Tailwind CDN, sidebar 240px, REC badge). Se mantiene la identidad de Fase 2 con tokens de `acta-mockups.html` (`.stamp`, `--ink`, `--stamp`, `--seal`, tipografía Archivo + IBM Plex Mono).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `playwright_vortex/prisma/schema.prisma` | Modified | +4 modelos, +1 enum, extensiones no-breaking |
| `playwright_vortex/prisma/migrations/` | New | Migración generada |
| `playwright_vortex/prisma/seed.ts` | Modified | Llama a `lib/credenciales/seed.ts` después de crear admin |
| `playwright_vortex/scripts/recorder-worker.ts` | New | Entrypoint del recorder-worker (HTTP + WS) |
| `playwright_vortex/lib/recorder/*` | New | Auth, registry, launch, screencast, http-api, ws-server |
| `playwright_vortex/lib/credenciales/*` | New | crypto + decrypt + seed |
| `playwright_vortex/lib/grabador/*` | New | actions (Server Action), types |
| `playwright_vortex/app/api/grabador/sesiones/*` | New | POST crear, GET estado |
| `playwright_vortex/app/api/proyectos/[id]/credenciales/route.ts` | New | GET lista |
| `playwright_vortex/app/(dashboard)/casos/grabar/*` | New | Páginas nueva, [sesionId], error/loading |
| `playwright_vortex/components/grabador/*` | New | Client + canvas + toolbar + panels |
| `playwright_vortex/components/casos/casos-client.tsx` | Modified | Botón "Grabar caso" |
| `playwright_vortex/components/proyectos/proyecto-card.tsx` | Modified | Link "Grabar caso" en contexto |
| `playwright_vortex/package.json` | Modified | `+ws`, script `dev` con concurrently |
| `playwright_vortex/.env.example` | Modified | 5 vars nuevas |
| `playwright_vortex/docker-compose.dev.yml` | Modified | Servicio `recorder` |
| `playwright_vortex/app/globals.css` | Modified | Clases nuevas (`.vp-chrome`, `.vp-stage`, `.vp-toolbar`, `.rec-badge`) siguiendo tokens del mockup |
| `playwright_vortex/e2e/grabador-iniciar.spec.ts` | New | E2E: abrir form, iniciar, esperar EN VIVO |
| `playwright_vortex/__tests__/...` | New | Tests unit + integration |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Latencia CDP screencast >200ms en dev | Medium | `everyNthFrame:1` + JPEG quality 80. Loggear latencia frame-a-frame en dev para detectar regresiones. Swap futuro a `Page.captureScreenshot` bajo demanda si duele (decisión diferida). |
| Recorder-worker se cae → sesiones zombie | Medium | Al arrancar, barre `SesionGrabacion` con `estado IN ('iniciando','activa')` y `tokenUsado=true` con más de 5 min sin heartbeat → marca `estado='error', mensajeError='worker reiniciado'`. |
| Token HMAC robado y reusado | Medium | Token de un solo uso: `tokenUsado=true` en DB al validar. Segunda conexión con mismo token → rechazo `WS close 4001`. |
| `Credencial.valor` almacenado en claro | High (estado actual) | Implementar `crypto.ts` AES-256-GCM ANTES de la primera escritura. No hay ciphertext legacy que migrar (credenciales no se usaban todavía). |
| Browser no instalado en container `recorder` | Low | Reusar `scripts/install-playwright-browsers.js` (ya corre en postinstall del app) y ejecutarlo en el `Dockerfile` del compose si se separa. |
| Recorder excede `RECORDER_MAX_SESSIONS` por error | Low | HTTP `/internal/start` valida el límite ANTES de crear la sesión DB; rechaza con 503. Si por race condition se pasa → `session-registry.add` rechaza y la sesión queda `estado='error'`. |
| Frontend abre WS antes de que Chromium termine de navegar | Medium | WS recibe `{type:'sesion_iniciando'}` mientras se navega, luego `{type:'sesion_lista'}` cuando el primer frame está listo. Frontend muestra "Iniciando…" hasta `sesion_lista`. |
| Schema migration rompe seed existente | Low | Todas las columnas nuevas nullable/default. Test: `prisma migrate dev` aplica limpia; casos previos quedan con `origen='subirScript'`. |

## Rollback Plan

Revertir el commit de squash-merge en `develop-fase2` (`feature/hu-g1-grabador-base → develop-fase2`). Si ya hay `SesionGrabacion` filas, dejarlas; la nueva columna `origen` en `CasoPrueba` tiene default `'subirScript'` así que el flujo anterior sigue funcionando con datos pre-existentes. El `Credencial.valor` queda cifrado (no se descifra si se elimina `lib/credenciales/crypto.ts`, pero como no había credenciales usadas antes, no hay pérdida real de datos).

Si el recorder-worker queda colgado en producción, basta con matar el proceso: las sesiones activas quedan con `estado='activa'` huérfanas y el barrido de inicio las limpia a `error` en el siguiente reinicio.

## Dependencies

- Stack Next.js 15.1 + React 19 + Prisma 6 + iron-session 8 ya instalado (sin cambios).
- `playwright` como dependencia transitiva de `@playwright/test` (sin nueva instalación).
- Patrón `scripts/worker.ts` + `lib/worker/claim.ts` como referencia de proceso long-lived con Prisma.
- Diseño visual de `fase2/mockups/grabar-test.html` + tokens de `documentacion/acta-mockups.html` (`.stamp`, paleta).
- `SESSION_SECRET` ya presente en `.env` (≥32 chars).

## Success Criteria

- [ ] `prisma migrate dev` aplica la migración sin errores; casos pre-existentes mantienen `origen='subirScript'`.
- [ ] El proceso `recorder-worker` arranca standalone (`node --import tsx scripts/recorder-worker.ts`) y expone `/health` 200.
- [ ] `POST /api/grabador/sesiones` con datos válidos devuelve `{sessionId, wsUrl, token}` en <1s y crea fila `SesionGrabacion` con `estado='iniciando'`.
- [ ] El frontend abre WS con el token, ve el badge "EN VIVO" en <5s (medido desde click en "Iniciar grabación").
- [ ] El screencast muestra frames JPEG actualizados en el `<canvas>` (latencia visible <500ms en dev).
- [ ] Si la URL no responde: la sesión queda `estado='error'`, el WS envía `{type:'error', msg}`, el frontend muestra error.tsx con mensaje específico en <12s (10s de timeout del `page.goto` + ~2s de margen).
- [ ] `GET /api/proyectos/[id]/credenciales` con sesión válida devuelve la lista sin el campo `valor`.
- [ ] `RECORDER_MAX_SESSIONS=1` con una sesión activa → segunda llamada a `/internal/start` devuelve 503.
- [ ] Reconexión de WS tras refresh de página: el cliente reabre con el mismo token (mientras la sesión esté activa) y retoma el stream sin reiniciar Chromium.
- [ ] Heartbeat: si pasan 10 min sin ping, la sesión queda `estado='detenida'`, pasos persistidos como borrador.
- [ ] Tests unit + integration + E2E pasan en CI.
- [ ] `npm run dev` levanta `web` + `worker` + `recorder` en paralelo sin colisiones de puerto.