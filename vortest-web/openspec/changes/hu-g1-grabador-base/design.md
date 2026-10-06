# Design: Iniciar sesión de grabación (HU-G1 + HU-G21 + HU-G22)

## Technical Approach

Tres procesos compartiendo el mismo Postgres:

```
┌──────────────────────┐    ┌──────────────────────┐    ┌─────────────────────────┐
│  Next.js (web)       │    │  worker (existing)   │    │  recorder-worker (new)  │
│  app/api/grabador/   │    │  scripts/worker.ts   │    │  scripts/recorder-      │
│  app/(dashboard)/    │    │  → poll Ejecucion    │    │  worker.ts              │
│  casos/grabar/       │    │  → run Playwright    │    │  → HTTP /internal/start │
│                      │    │                      │    │  → WS screencast        │
└──────────┬───────────┘    └──────────┬───────────┘    └──────────┬──────────────┘
           │                           │                            │
           │     POST /api/grabador/sesiones                     │
           │     → valida, crea DB, llama recorder                │
           │                                                        │
           │  POST /internal/start (X-Internal-Secret)             │
           ├────────────────────────────────────────────────────────▶
           │  ◀─── { token, wsUrl }  (sync, browser launch async)  │
           │                                                        │
           │  { sessionId, wsUrl, token }                           │
           │  al frontend                                            │
           │                                                        │
           │  WS ws://RECORDER_PUBLIC_URL/?token=…                 │
           │  ◀═══════════════════════════════════════════════════════
           │  {type:'frame', data:'<jpeg>'} cada N ms              │
           │  {type:'sesion_lista'}                                 │
           │  {type:'error', msg}                                   │
           │                                                        │
           └───────────┬────────────────────────────────────────────┘
                       ▼
                  ┌────────────┐
                  │  Postgres  │
                  │ SesionGrabacion │ PasoGrabado │ ParametroGrabacion │
                  │ CasoPrueba.origen│ Credencial.valor (AES-GCM) │
                  └────────────┘
```

El recorder-worker es un **proceso Node standalone** (no un Next.js route) porque:
1. Mantener un Chromium abierto durante minutos no escala en el proceso de Next.js (memoria + lifecycle).
2. Las conexiones WebSocket de larga duración no encajan en el modelo serverless/route-handler.
3. Reusa el patrón de polling/ejecución ya establecido en `scripts/worker.ts`.

El WS del recorder NO requiere cookie de sesión: el token HMAC viaja como query param y se valida una sola vez (`tokenUsado=true`). Esto evita problemas con el middleware de Next.js (que excluye `/api`) y mantiene la auth coherente con la API HTTP interna.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Recorder como proceso separado | `scripts/recorder-worker.ts` standalone (no Next.js route) | Next.js con `socket.io` + long-lived connection | Aislamiento de memoria/CPU; ciclo de vida del browser independiente; mismo patrón que `scripts/worker.ts` |
| Stream en vivo | CDP `Page.startScreencast` (JPEG q80, everyNthFrame:1) | noVNC + Xvfb; MJPEG via `Page.captureScreenshot` | CDP es nativo de Playwright, ya instalado, latencia aceptable; evita Xvfb |
| Auth WS | HMAC-SHA256(token) con `SESSION_SECRET`, un solo uso | Cookie iron-session; JWT firmado | El WS server no comparte proceso con Next.js → no puede leer la cookie sin cambio de arquitectura. HMAC es stateless y se valida en <1ms |
| Crypto de credenciales | AES-256-GCM con key = `scrypt(SESSION_SECRET, salt, 32)` | RSA; envelope encryption con KMS | Ya tenemos `SESSION_SECRET`; no queremos agregar KMS para MVP. AES-GCM da confidencialidad + integridad |
| Concurrencia del recorder | `RECORDER_MAX_SESSIONS` enforced en registry | Sin límite (riesgo DoS); basado en memoria disponible | Configurable, default 3 (ajustable). Para multi-tenant futuro se cambia a scheduler |
| Heartbeat | Frontend envía `{type:'heartbeat'}` cada 15s; recorder expira a 10 min sin ping | Long-poll HTTP cada 5s; WebSocket ping/pong frames | Heartbeat explícito permite controlar lógica de expiración + reconnect con backoff |
| Token en URL | `ws://host/?token=…` | Header `Sec-WebSocket-Protocol` | Más simple para el cliente; aceptable porque el token es de un solo uso y efímero |
| WS reconnect con backoff 1-5s | Frontend maneja reconexión; mismo token mientras sesión activa | Recorder cierra y reabre; cliente pide nuevo token | UX de "refrescar la página no rompe la sesión"; token reusable mientras esté vivo |
| Mockup de referencia | `fase2/mockups/grabar-test.html` + tokens `acta-mockups.html` (`.stamp`, paleta) | Solo acta-mockups; solo grabar-test | El mockup de Fase 2 está mejor resuelto (REC badge, sidebar 240px), pero conservamos la identidad del sello rojo inclinado como elemento de marca |
| Botón "Grabar caso" paralelo a "+ Nuevo Caso" | Sin mode selector formal | Implementar HU-G20 ahora | HU-G20 es PR-4 → fuera de scope de este PR. Coexistencia temporal |
| Persistir `storageState` en `SesionGrabacion` | Sí, como `Json?` descifrado | Pasarlo solo en memoria; pedirlo cada vez | Necesario para reanudar sesión tras refresh del recorder-worker; el `valor` ya está cifrado en `Credencial` así que el duplicado en `SesionGrabacion` no es riesgo de seguridad |
| Token storage | En la fila `SesionGrabacion` (campo `token`) | Solo en memoria del recorder; reissue por endpoint | Persistido: permite que el recorder-worker se reinicie sin invalidar sesiones en curso |

## Data Flow

### Flujo "Iniciar grabación exitosa"

```
1. Usuario en /casos/grabar/nueva completa form y hace click "Iniciar grabación"
2. POST /api/grabador/sesiones {nombre, urlInicial, ambiente, credencialId, navegador}
3. Server Action valida session (iron-session) + requireSuperadmin(session)
4. Crea fila SesionGrabacion {estado:'iniciando', usuarioId, proyectoId, ...}
5. POST http://recorder-host:3100/internal/start
   Headers: X-Internal-Secret: <RECORDER_INTERNAL_SECRET>
   Body: {sessionId, userId, urlInicial, storageState, navegador}
6. recorder-worker:
   a. Valida secret → 401 si inválido
   b. session-registry.add(sessionId) → 503 si RECORDER_MAX_SESSIONS alcanzado
   c. Genera token = HMAC-SHA256(SESSION_SECRET, `${sessionId}|${userId}|${exp}`)
   d. Persiste token en DB (UPDATE SesionGrabacion SET token=…)
   e. (ASYNC) launchPersistentContext({headless:true, storageState}) → goto URL → startScreencast
   f. Devuelve {token, wsUrl} sincrónicamente
7. Server Action guarda wsUrl en DB; devuelve {sessionId, wsUrl, token} al cliente
8. Cliente hace redirect a /casos/grabar/[sesionId]
9. Página server-renderiza con <GrabadorClient sessionId={...} initialToken={...} wsUrl={...} />
10. Cliente abre WS ws://host:3100/?token=… 
11. recorder-worker valida token:
    a. SELECT SesionGrabacion WHERE token=… AND tokenUsado=false
    b. UPDATE SET tokenUsado=true
    c. Adjunta cliente al SessionEntry
    d. Envía {type:'sesion_iniciando'} si Chromium aún no terminó goto
    e. Cuando llega primer frame → {type:'sesion_lista'} + frames subsiguientes
12. Cliente pinta frames en <canvas>; muestra badge "EN VIVO"
```

### Flujo "URL no accesible"

```
1-7. Igual hasta que el recorder-worker hace page.goto(url, {timeout:10000})
8. goto falla (timeout/DNS/cert)
9. recorder-worker:
   a. UPDATE SesionGrabacion SET estado='error', mensajeError=<reason>
   b. Cierra context
   c. Envía {type:'error', msg:<reason>} al cliente WS
   d. Cierra WS (code 4002)
10. Cliente ve badge "ERROR"; redirige a /casos/grabar/[sesionId]/error?reason=…
11. Página error.tsx muestra mensaje + botón "Reintentar"
```

## File Changes

### Schema (`playwright_vortex/prisma/schema.prisma`)

| Change | Description |
|--------|-------------|
| Add `enum CasoOrigen { subirScript, grabador, mixto }` | Después de los enums existentes |
| `model CasoPrueba` | + `origen CasoOrigen @default(subirScript)`, + back-relations `pasosGrabados`, `parametros`, `juegosDeDatos` |
| Add `model SesionGrabacion` | id (uuid), proyectoId, usuarioId, casoPruebaId?, nombre, urlInicial, ambiente, navegador, credencialId?, storageState Json?, token String?, tokenUsado Bool @default(false), estado String, mensajeError String?, startedAt DateTime?, endedAt DateTime?, createdAt, updatedAt, @@index([proyectoId]), @@index([usuarioId]), @@index([estado]) |
| Add `model PasoGrabado` | id, sesionId, numero Int, tipo String, origen String, descripcion String, selectorPrincipal Json, selectoresRespaldo Json, valor String?, esValorSensible Bool @default(false), assertionKind String?, createdAt, @@unique([sesionId, numero]), @@index([sesionId]) |
| Add `model ParametroGrabacion` | id, sesionId?, casoPruebaId?, nombre, valorDefecto String?, origen String, credencialId String?, enUso Bool @default(true), @@unique([sesionId, nombre]), @@index([casoPruebaId]) |
| Add `model JuegoDeDatos` | id, casoPruebaId, nombreArchivo, filas Json, createdAt, @@index([casoPruebaId]) |
| `model Ejecucion` | + `loteId String?` (HU-G13 stub) |
| `model PasoEjecucion` | + `videoInicioMs Int?`, `videoFinMs Int?` (HU-G18 stub) |

Migración: generada con `prisma migrate dev --name hu_g21_grabador_models`. Todos los cambios son no-breaking (default o nullable).

### Recorder-worker (new)

| File | Description |
|------|-------------|
| `playwright_vortex/scripts/recorder-worker.ts` | Entrypoint: HTTP API + WS server + startup orphan-cleanup. ~80 líneas |
| `playwright_vortex/lib/recorder/auth.ts` | `issueToken(sessionId, userId, ttlSec)` / `validateToken(token)`. HMAC-SHA256 con `SESSION_SECRET`. ~40 líneas |
| `playwright_vortex/lib/recorder/session-registry.ts` | `add(entry)`, `remove(sessionId)`, `get(sessionId)`, `attachClient(sessionId, ws)`, `detachClient`. Límite `RECORDER_MAX_SESSIONS`. ~80 líneas |
| `playwright_vortex/lib/recorder/launch-session.ts` | `launchSession({sessionId, urlInicial, storageState})` retorna `{context, page, cdp}`. Maneja errores de goto. ~120 líneas |
| `playwright_vortex/lib/recorder/screencast.ts` | `startScreencast(page, onFrame)`. Llama `cdp.send('Page.startScreencast', …)` y reenvía `Page.screencastFrame` events. ~60 líneas |
| `playwright_vortex/lib/recorder/http-api.ts` | HTTP server nativo (`node:http`): `POST /internal/start`, `GET /health`. ~100 líneas |
| `playwright_vortex/lib/recorder/ws-server.ts` | `ws.Server`: handshake por token, broadcast de frames. ~80 líneas |
| `playwright_vortex/lib/recorder/types.ts` | Tipos compartidos: `SessionEntry`, `WsClientMessage`, `WsServerMessage` |

### Credenciales (new)

| File | Description |
|------|-------------|
| `playwright_vortex/lib/credenciales/crypto.ts` | `encryptCredencial(plain: string): Buffer`, `decryptCredencial(ciphertext: Buffer): string`. AES-256-GCM con `scrypt(SESSION_SECRET, 'acta-credencial-salt', 32)`. ~50 líneas |
| `playwright_vortex/lib/credenciales/decrypt.ts` | Helper que descifra y devuelve JSON parseado. ~20 líneas |
| `playwright_vortex/lib/credenciales/seed.ts` | Crea 1 `Credencial` de muestra si no existe: `{nombre:'Demo QA', tipo:'storageState', valor: encryptCredencial(JSON.stringify({cookies:[], origins:[]}))}`. Idempotente. ~30 líneas |

### Next.js routes + actions (new)

| File | Description |
|------|-------------|
| `playwright_vortex/app/api/grabador/sesiones/route.ts` | `POST`: valida auth, crea `SesionGrabacion`, llama recorder HTTP, devuelve `{sessionId, wsUrl, token}` |
| `playwright_vortex/app/api/grabador/sesiones/[id]/route.ts` | `GET`: devuelve estado actual de la sesión (para rehidratación) |
| `playwright_vortex/app/api/proyectos/[id]/credenciales/route.ts` | `GET`: lista credenciales del proyecto (sin `valor`) |
| `playwright_vortex/lib/grabador/actions.ts` | `iniciarSesionGrabacion(input, session)` Server Action |
| `playwright_vortex/lib/grabador/types.ts` | `NuevaGrabacionInput`, `SesionGrabacionOut` |
| `playwright_vortex/lib/grabador/recorder-client.ts` | Cliente HTTP para llamar `/internal/start` desde Next.js (con `RECORDER_INTERNAL_SECRET`) |

### Frontend (new)

| File | Description |
|------|-------------|
| `playwright_vortex/app/(dashboard)/casos/grabar/nueva/page.tsx` | Server Component que carga credenciales del proyecto (default si no hay proyectoId en query) y monta `<NuevaGrabacionForm>` |
| `playwright_vortex/app/(dashboard)/casos/grabar/[sesionId]/page.tsx` | Server Component que carga sesión + monta `<GrabadorClient>` |
| `playwright_vortex/app/(dashboard)/casos/grabar/[sesionId]/loading.tsx` | Skeleton del viewport mientras WS conecta |
| `playwright_vortex/app/(dashboard)/casos/grabar/[sesionId]/error.tsx` | Error boundary con razón + botón reintentar |
| `playwright_vortex/components/grabador/nueva-grabacion-form.tsx` | Client form con React state + `useActionState(iniciarSesionGrabacion)` |
| `playwright_vortex/components/grabador/grabador-client.tsx` | Client Component: useState para WS, useEffect para conectar, useRef para canvas. Maneja reconexión con backoff exponencial 1-5s. Heartbeat cada 15s. ~200 líneas |
| `playwright_vortex/components/grabador/screencast-canvas.tsx` | `<canvas>` que recibe `{frame: string}` y pinta con `requestAnimationFrame` |
| `playwright_vortex/components/grabador/paso-panel.tsx` | Panel derecho: header + lista de pasos (vacía en G1, populated en G3) |
| `playwright_vortex/components/grabador/rec-toolbar.tsx` | Toolbar inferior: Señalar / Verificar / Parámetro / Pausar (botones `disabled`, lógica en HUs siguientes) |
| `playwright_vortex/components/grabador/connection-status.tsx` | Badge con estado: EN VIVO / RECONECTANDO / INICIANDO / ERROR (con pulso CSS) |
| `playwright_vortex/components/grabador/url-bar.tsx` | Barra de URL que se actualiza desde evento WS |

### Modificaciones

| File | Change |
|------|--------|
| `playwright_vortex/package.json` | +`"ws": "^8.18.0"` en dependencies. Modificar script `dev`: `concurrently -k -n web,worker,recorder -c blue,magenta,green "next dev" "node --import tsx scripts/worker.ts" "node --import tsx scripts/recorder-worker.ts"` |
| `playwright_vortex/.env.example` | +5 vars: `RECORDER_WS_PORT=3100`, `RECORDER_PUBLIC_URL=ws://localhost:3100`, `RECORDER_INTERNAL_SECRET=`, `RECORDER_MAX_SESSIONS=3`, `RECORDER_HEARTBEAT_TIMEOUT_MS=600000` |
| `playwright_vortex/docker-compose.dev.yml` | +servicio `recorder` que comparte volúmenes con `app`, expone 3100, depende de postgres |
| `playwright_vortex/prisma/seed.ts` | Al final, llama `await seedCredencialDemo(prisma)` |
| `playwright_vortex/components/casos/casos-client.tsx` | +botón `<Link href="/casos/grabar/nueva">Grabar caso</Link>` al lado de `+ Nuevo Caso` |
| `playwright_vortex/app/(dashboard)/proyectos/[id]/casos/page.tsx` | +botón "Grabar caso" en el topbar (link a `/casos/grabar/nueva?proyectoId=…`) |
| `playwright_vortex/app/globals.css` | +`.vp-chrome`, `.vp-stage`, `.vp-toolbar`, `.rec-badge`, `.rec-pulse` (keyframes) |

### Tests (new)

| File | Description |
|------|-------------|
| `playwright_vortex/__tests__/lib/recorder/auth.test.ts` | HMAC issue/validate, expiración, replay rejection |
| `playwright_vortex/__tests__/lib/recorder/session-registry.test.ts` | add/remove/get, concurrent limit |
| `playwright_vortex/__tests__/lib/credenciales/crypto.test.ts` | encrypt/decrypt round-trip, ciphertext distinto por nonce |
| `playwright_vortex/__tests__/lib/grabador/actions.test.ts` | iniciarSesionGrabacion con mocks de recorder HTTP |
| `playwright_vortex/__tests__/api/grabador/sesiones.test.ts` | POST con sesión inválida → 401; con credencial inexistente → 400; OK → 201 |
| `playwright_vortex/__tests__/api/proyectos/[id]/credenciales.test.ts` | GET sin sesión → 401; GET con sesión → 200 sin `valor` |
| `playwright_vortex/e2e/grabador-iniciar.spec.ts` | E2E: login, abrir form, llenar, click, esperar EN VIVO <5s, captura canvas |

## Interfaces / Contracts

### Tipos compartidos (`lib/recorder/types.ts`)

```typescript
import type { Page, BrowserContext, WebSocket } from 'playwright';
import type { WebSocket as WsServer } from 'ws';

export interface SessionEntry {
  sessionId: string;
  userId: string;
  urlInicial: string;
  context: BrowserContext;
  page: Page;
  cdp: any; // CDP session
  clients: Set<WsServer>;
  heartbeatTimer: NodeJS.Timeout;
  createdAt: Date;
}

export type WsClientMessage =
  | { type: 'heartbeat' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' };

export type WsServerMessage =
  | { type: 'sesion_iniciando' }
  | { type: 'sesion_lista'; ts: number }
  | { type: 'frame'; data: string; ts: number }
  | { type: 'sesion_pausada' }
  | { type: 'sesion_reanudada' }
  | { type: 'sesion_detenida' }
  | { type: 'paso_agregado'; paso: PasoGrabadoDTO } // wire-up en G3
  | { type: 'error'; msg: string };

export interface PasoGrabadoDTO {
  numero: number;
  tipo: string;
  descripcion: string;
  selectorPrincipal: unknown;
  valor?: string;
}
```

### API Contracts

**`POST /api/grabador/sesiones`**
```typescript
// Request
interface NuevaGrabacionInput {
  proyectoId: string;
  nombre: string;
  urlInicial: string;
  ambiente: 'QA' | 'Staging' | 'Prod';
  credencialId: string;
  navegador: 'chromium';
}

// Response 201
interface SesionGrabacionOut {
  sessionId: string;
  wsUrl: string;
  token: string;
}

// Errors
// 400 {error:'validation', message:'URL inválida'}
// 400 {error:'validation', message:'Credencial no pertenece al proyecto'}
// 401 {error:'auth', message:'Sin sesión'}
// 503 {error:'recorder_unavailable', message:'Recorder no responde'}
// 503 {error:'max_sessions', message:'Hay N grabaciones activas'}
```

**`GET /api/grabador/sesiones/[id]`**
```typescript
// Response 200
interface SesionEstado {
  id: string;
  estado: 'iniciando' | 'activa' | 'pausada' | 'detenida' | 'descartada' | 'guardada' | 'error';
  mensajeError?: string;
  startedAt?: string;
  endedAt?: string;
}
```

**`GET /api/proyectos/[id]/credenciales`**
```typescript
// Response 200
type CredencialListItem = Array<{
  id: string;
  nombre: string;
  tipo: 'storageState' | 'cookies' | 'userPass';
  vence: string | null; // ISO date
}>;
```

**`POST /internal/start`** (recorder-worker HTTP interno)
```typescript
// Request
Headers: { 'X-Internal-Secret': string }
Body: {
  sessionId: string;
  userId: string;
  urlInicial: string;
  storageState: object | null; // Playwright storageState JSON
  navegador: 'chromium';
}

// Response 200
{ token: string; wsUrl: string }

// Errors
// 401 {error:'unauthorized'}
// 503 {error:'MAX_SESSIONS_REACHED'}
```

**`WS /?token=…`** (recorder-worker)
- Server → Client: `WsServerMessage`
- Client → Server: `WsClientMessage`
- Auth: token validado una sola vez (`tokenUsado=true` en DB); conexión sin token → close 4001.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | `auth.ts` HMAC issue/validate | Tokens firmados con SESSION_SECRET de test; expiración; replay detection |
| Unit | `session-registry.ts` add/remove/limit | Mock registry; assert RECORDER_MAX_SESSIONS enforcement |
| Unit | `credenciales/crypto.ts` round-trip | encrypt → decrypt === plain; ciphertext distinto en cada call (nonce) |
| Unit | `grabar/actions.ts` orquestación | Mock recorder HTTP; validar que crea SesionGrabacion, llama `/internal/start`, devuelve token |
| Integration | `POST /api/grabador/sesiones` | Mock HTTP recorder; 401 sin sesión; 400 credencial inválida; 201 OK con token |
| Integration | `GET /api/proyectos/[id]/credenciales` | Sin sesión → 401; con sesión → 200 sin `valor` |
| Integration | Recorder-worker lifecycle | Spawn worker en puerto random; crear sesión; verificar que Chromium arranca y WS acepta conexión |
| E2E | Flujo completo "Iniciar grabación exitosa" | Playwright E2E: login → /casos/grabar/nueva → form → click → espera badge EN VIVO <5s; mide tiempo |
| E2E | URL no accesible | Playwright E2E: form con URL `http://localhost:1`; espera error.tsx en <12s |

## Migration / Rollout

No data migration required. La migración Prisma es aditiva (todos los defaults/nullable). El seed crea 1 credencial de demo automáticamente; no hay credenciales previas que cifrar.

Rollback: revertir el commit de squash-merge. La columna `origen` en `CasoPrueba` queda con default `subirScript`, así que casos pre-existentes siguen funcionando. La columna `valor` de `Credencial` queda cifrada; si se quita `lib/credenciales/crypto.ts`, la lectura falla, pero como no había credenciales usadas antes, no hay pérdida real.

Para docker-compose: el servicio `recorder` se agrega con `restart: "no"` y depende de `postgres`. La primera vez que se levante, ejecuta `playwright install chromium` (ya cached en la imagen base).

## Open Questions

- [ ] ¿El recorder-worker debe correr dentro del mismo contenedor que `app` o como servicio separado? Decisión: **servicio separado** en docker-compose para aislar memoria de Chromium; en dev local con `concurrently` corre como proceso hermano.
- [ ] ¿Cuántas sesiones concurrentes soportar por defecto? Decisión: `RECORDER_MAX_SESSIONS=3` (ajustable).
- [ ] ¿Qué hacer con el token cuando se reinicia el recorder-worker? Decisión: token persiste en DB → el cliente puede reconectar con el mismo token tras reinicio (mientras la sesión siga activa).
- [ ] ¿Persistimos frames como artefactos para audit? Decisión: **no en G1**; se agregan en HU-G18 si hace falta.
- [ ] ¿El `__pw_report` listener se wire-ea en G1 o se difiere? Decisión: en G1 el listener existe pero no se usa (`page.exposeFunction('__pw_report', () => {})`); G3 lo conecta al traductor de pasos. Esto evita una reescritura de `addInitScript` cuando llegue G3.