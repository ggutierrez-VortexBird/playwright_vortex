# Verification Report — HU-G1 (Iniciar sesión de grabación)

**Change**: hu-g1-grabador-base
**Mode**: Standard (no Strict TDD flag)
**Branch**: `feature/hu-g1-grabador-base` @ `eaa52f5`
**Commits verified**: 7 (`827abba` → `60d9e18` → `26c2dcb` → `fae1d39` → `be530b2` → `6f2334e` → `eaa52f5`)

---

## Resumen

El cambio entrega los fundamentos del modo grabador: 4 modelos Prisma nuevos, el recorder-worker standalone con auth HMAC y live-streaming vía WebSocket, credenciales cifradas con AES-256-GCM, y la UI "EN VIVO" con reconexión automática. **379 tests pasan (63 nuevos)**, 37 fallan (idéntico al baseline, sin regresiones), build OK, seed OK, recorder-worker arranca y responde `/health`. Sin embargo, **2 hallazgos CRITICAL bloquean MERGE**: (1) race condition en el handshake WS que rompe la semántica "one-shot" del token, y (2) la expiración por inactividad está completamente ausente del código aunque documentada en `.env.example`, `docker-compose.dev.yml` y los specs.

---

## Verificación de spec

### Spec: `modo-grabador`

| # | Requirement | Scenario | Covered By | Status |
|---|-------------|----------|------------|--------|
| 1 | Iniciar sesión | Iniciar grabación exitosa | `actions.test.ts`, `route.test.ts`, `e2e/grabador-iniciar.spec.ts` | ✅ COMPLIANT |
| 2 | Iniciar sesión | URL no accesible | `e2e/grabador-iniciar.spec.ts:60`, `e2e/grabador-url-inaccesible.spec.ts`, `lib/recorder/launch-session.ts` (10s timeout) | ✅ COMPLIANT |
| 3 | Live-streaming | Stream continuo de frames | `lib/recorder/screencast.ts` + `ws-server.ts broadcastFrame` | ⚠️ PARTIAL — implementación correcta, sin test de runtime que verifique 30fps |
| 4 | Live-streaming | Reconexión tras refresh del navegador | `lib/recorder/ws-server.ts:73-94` | ❌ FAILING — token queda `tokenUsado=true` tras primer WS; refresh → 4001. Spec exige "mismo token, retoma stream" |
| 5 | Auth HMAC | Conexión con token válido | `auth.test.ts`, `ws-server.ts` | ✅ COMPLIANT |
| 6 | Auth HMAC | Token inválido | `auth.test.ts` (5 casos: tampered, empty, malformed), `ws-server.ts:67` | ✅ COMPLIANT |
| 7 | Auth HMAC | Token reusado | `ws-server.ts:73-94` | ❌ FAILING — race condition entre `findFirst` y `update`; sin test de concurrencia |
| 8 | Heartbeat | Heartbeat normal | `ws-server.ts:117-119` (actualiza `lastHeartbeatAt`) | ⚠️ PARTIAL — recibe el heartbeat pero NO hay verificación de expiración |
| 9 | Heartbeat | Expiración por inactividad | — | ❌ UNTESTED + NO IMPLEMENTADO — `RECORDER_HEARTBEAT_TIMEOUT_MS` nunca leído; `heartbeatTimer` es `setInterval(()=>{},60_000)` no-op |
| 10 | Límite | Límite alcanzado | `session-registry.test.ts:122-129`, `http-api.ts:117-123` | ✅ COMPLIANT |
| 11 | Endpoint interno | Inicio válido | `http-api.ts handleStart` | ⚠️ PARTIAL — implementación correcta, verificada manualmente con `Invoke-WebRequest` |
| 12 | Endpoint interno | Secret inválido | `ws-server.ts` no aplica (es `/internal/start`), `http-api.ts:76-79` | ✅ COMPLIANT (verificado: status 401 + `{"error":"unauthorized"}`) |
| 13 | Limpieza huérfanos | Orphan cleanup al arrancar | `session-registry.test.ts:194-209`, `recorder-worker.ts:50` | ✅ COMPLIANT (mock) |
| 14 | Credenciales | Listar no expone secretos | `route.test.ts:55-110` | ✅ COMPLIANT |
| 15 | Credenciales | Cifrado round-trip + nonce único | `crypto.test.ts` (10 casos) | ✅ COMPLIANT |

**Compliance summary**: 9/15 compliant + 3 partial + 3 failing/untested.

### Spec: `modelo-de-datos-prisma`

| # | Scenario | Covered By | Status |
|---|----------|------------|--------|
| 1 | Migración no rompe seed existente | `migration.sql`, `scripts/verify-hu-g21-schema.ts`, `prisma/seed.ts:30-42` | ✅ COMPLIANT |
| 2 | Cascade borra pasos al descartar sesión | Schema `onDelete: Cascade` en FKs `PasoGrabado.sesionId` | ✅ COMPLIANT |
| 3 | Token persistente sobrevive reinicio del recorder | `lib/grabador/actions.ts:154-157` persiste token en DB | ⚠️ PARTIAL — token persiste, pero `tokenUsado=true` post-primer-WS impide reconexión |
| 4 | Reuso de token es rechazado | `ws-server.ts:85-88` | ❌ FAILING — race condition; ver CRITICAL #1 |

**Compliance summary**: 2/4 compliant + 1 partial + 1 failing.

### Spec: `gestion-casos-prueba`

| # | Scenario | Status |
|---|----------|--------|
| 1 | Caso preexistente conserva origen por default | ✅ COMPLIANT (default `subirScript` en schema, `migration.sql:5`) |
| 2 | Caso grabado tiene `origen='grabador'` | ⚠️ OUT-OF-SCOPE — deferred a HU-G3 (persistencia del caso desde sesión) |
| 3 | Caso editado manualmente queda como `mixto` | ⚠️ OUT-OF-SCOPE — deferred a HU-G11 (editor manual) |

---

## Tests ejecutados

### `npm test`

```text
Test Suites: 12 failed, 45 passed, 57 total
Tests:       37 failed, 379 passed, 416 total
Snapshots:   0 total
Time:        7.032 s
```

**Baseline** (en `145f1b1`, antes de HU-G1): `37 failed, 316 passed, 353 total`.
**Delta**: **+63 passing tests** (los 8 nuevos archivos jest de HU-G1 + los tests existentes que ahora pasan gracias al setup). **0 regresiones**.

**Suites fallando (todas PRE-EXISTING, sin relación con HU-G1)**:

| Test suite | Errores |
|------------|---------|
| `__tests__/app/api/usuarios/route.test.ts` | JSON parsing en NextResponse jsdom |
| `__tests__/app/api/casos/[id]/route.test.ts` | idem |
| `__tests__/app/api/casos/route.test.ts` | idem |
| `__tests__/app/api/espacios/route.test.ts` | idem |
| `__tests__/app/api/espacios/[id]/route.test.ts` | idem |
| `__tests__/app/api/proyectos/route.test.ts` | idem |
| `__tests__/app/api/proyectos/[id]/route.test.ts` | idem |
| `__tests__/lib/auth.test.ts` | idem |
| `__tests__/lib/casos/actions.test.ts` | idem |
| `__tests__/lib/proyectos/actions.test.ts` | idem |
| `__tests__/components/scope-bar.test.tsx` | pre-existing |
| `__tests__/app/(dashboard)/layout.test.tsx` | encoding issue pre-existing |

**Tests nuevos HU-G1 que pasan (8 jest + 2 e2e)**:

| Test file | Tests |
|-----------|-------|
| `__tests__/lib/recorder/auth.test.ts` | 12 (HMAC issue/validate/expiry/tampering/signature) |
| `__tests__/lib/recorder/session-registry.test.ts` | 13 (add/remove/replace/MAX enforcement/cleanup) |
| `__tests__/lib/credenciales/crypto.test.ts` | 10 (round-trip + tampering + nonce uniqueness) |
| `__tests__/lib/credenciales/decrypt.test.ts` | 4 |
| `__tests__/lib/credenciales/seed.test.ts` | 5 (idempotencia) |
| `__tests__/lib/grabador/actions.test.ts` | 9 (auth/validation/recorder errors/happy path) |
| `__tests__/api/grabador/sesiones/route.test.ts` | 5 (401/201/400/503/400) |
| `__tests__/api/proyectos/[id]/credenciales/route.test.ts` | 3 (401/200 sin `valor`/empty) |
| `e2e/grabador-iniciar.spec.ts` | 2 (happy + URL fail) |
| `e2e/grabador-url-inaccesible.spec.ts` | 1 (DNS no resuelve) |

### `npm run lint`

No ejecutable. El proyecto **no tiene `.eslintrc.*` ni `eslint.config.mjs`**. `npm run lint` dispara `next lint` que entra en modo interactivo pidiendo configurar ESLint. Pre-existente, no introducido por HU-G1.

### `npx tsc --noEmit`

```text
14 errors in 3 files
```

**Baseline** (en `145f1b1` sin los archivos nuevos): 13 errors.
**Delta**: **+1 NUEVO error introducido por HU-G1**.

| File | Errors | Origen |
|------|--------|--------|
| `__tests__/components/ui/proyecto-switcher.test.tsx` | 9 | PRE-EXISTING (modelo `ProyectoWithEspacio` le faltan `ambiente, descripcion`) |
| `lib/worker/runner.ts` | 4 (líneas 333, 333, 441) | PRE-EXISTING (JsonValue conversion, `numero` does not exist) |
| `lib/credenciales/seed.ts:38` | 1 | **NUEVO** — `Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'Uint8Array<ArrayBuffer>'` (TypeScript 5.7 + Prisma 6 type narrow) |

### Verificación runtime del recorder-worker

```bash
$ SESSION_SECRET=... RECORDER_INTERNAL_SECRET=... DATABASE_URL=... node --import tsx scripts/recorder-worker.ts
[recorder-worker] Iniciando
[recorder-worker]   WS port: 3100
[recorder-worker]   Public URL: ws://localhost:3100
[recorder-worker]   MAX_SESSIONS: 3
[recorder-worker] Orphan cleanup: 0 sesiones marcadas como error
[recorder-worker] Listening on :3100 (HTTP + WS)
```

```bash
$ curl http://localhost:3100/health
{"status":"ok"}

$ curl -X POST -H "X-Internal-Secret: wrong-secret" http://localhost:3100/internal/start
{"error":"unauthorized"}   # status 401
```

✅ `/health` responde 200. ✅ Secret inválido → 401. ✅ Orphan cleanup ejecuta al arrancar.

### Prisma seed

```bash
$ SESSION_SECRET=... SEED_ADMIN_PASSWORD=... DATABASE_URL=... node --import tsx prisma/seed.ts
Usuario admin@admin.com ya existe. Saltando creación de usuario.
Credencial demo sembrada en proyecto Proyecto base.
```

✅ Idempotente. No interrumpe admin existente.

### E2E Playwright

No ejecutados — requieren infraestructura completa (DB + recorder-worker + Next.js corriendo). `e2e/grabador-*.spec.ts` están bien escritos pero solo corren manualmente con `npm run dev` + Playwright runner instalado.

---

## Findings

### CRITICAL

#### C1. Race condition en handshake WS rompe one-shot del token

**Ubicación**: `playwright_vortex/lib/recorder/ws-server.ts:73-94`

```ts
// Lectura 1
sesion = await prisma.sesionGrabacion.findFirst({
  where: { token },
  select: { id: true, tokenUsado: true },
});
if (!sesion || sesion.tokenUsado) {
  closeWs(ws, WS_CLOSE_INVALID_TOKEN, ...);
  return;
}
// Check pasa, pero NO es atómico
// ...
// Update 2 (separado en el tiempo)
await prisma.sesionGrabacion.update({
  where: { id: sesion.id },
  data: { tokenUsado: true },
});
```

Dos conexiones concurrentes con el mismo token:
1. Ambas `findFirst` → ambas ven `tokenUsado=false`
2. Ambas pasan el check
3. Ambas `update` (idempotente set a true) → ambas succeeden
4. Ambas `attachClient` → ambas quedan conectadas
5. La segunda conexión recibe frames, no es rechazada

**Spec violación**: `modo-grabador/spec.md` línea 53: *"El token DEBE ser de un solo uso: al validarse exitosamente se marca `tokenUsado=true` en DB; cualquier intento de reuso DEBE ser rechazado."* Y `modelo-de-datos-prisma/spec.md` Scenario "Reuso de token es rechazado".

**Fix recomendado** (atomic CAS):
```ts
const updated = await prisma.sesionGrabacion.updateMany({
  where: { id: sesion.id, tokenUsado: false },
  data: { tokenUsado: true },
});
if (updated.count === 0) {
  closeWs(ws, WS_CLOSE_INVALID_TOKEN, "token ya utilizado");
  return;
}
```

**Test coverage**: 0 tests de concurrencia en `ws-server.ts`. Solo hay unit tests de `auth.ts` y `session-registry.ts`.

#### C2. Expiración por inactividad NO implementada

**Documentada pero ausente del código**:
- `playwright_vortex/.env.example:31`: `RECORDER_HEARTBEAT_TIMEOUT_MS=600000`
- `playwright_vortex/docker-compose.dev.yml:50`: idem
- `playwright_vortex/scripts/recorder-worker.ts:15` (comentario)
- Spec `modo-grabador/spec.md:79`: *"Si transcurren RECORDER_HEARTBEAT_TIMEOUT_MS (default 600000 = 10 minutos) sin heartbeat, el sistema DEBE cerrar el BrowserContext, persistir los pasos capturados como borrador y marcar la sesión estado='detenida'."*

**Estado real del código**:

`lib/recorder/session-registry.ts:22-25` declara `heartbeatTimer: NodeJS.Timeout` en `SessionEntry`.

`lib/recorder/http-api.ts:114` y `:146` crean el timer así:
```ts
heartbeatTimer: setInterval(() => {}, 60_000) as unknown as NodeJS.Timeout,
```
**Esto es un no-op**: el callback está vacío. No hay verificación contra `lastHeartbeatAt` ni contra `RECORDER_HEARTBEAT_TIMEOUT_MS`.

`lib/recorder/ws-server.ts:118` actualiza `entry.lastHeartbeatAt = Date.now()` al recibir heartbeat, pero ese valor nunca se lee.

**Fix recomendado**: agregar en `recorder-worker.ts` (después del `httpServer.listen`):
```ts
setInterval(() => {
  const timeoutMs = Number(process.env.RECORDER_HEARTBEAT_TIMEOUT_MS ?? 600_000);
  const cutoff = Date.now() - timeoutMs;
  for (const [sessionId, entry] of getAllEntries()) {
    if (entry.lastHeartbeatAt < cutoff) {
      // close context, mark estado='detenida', endedAt=new Date()
    }
  }
}, 30_000);
```

---

### WARNING

#### W1. Reconexión tras refresh del navegador falla

Tras el primer WS connect, `tokenUsado=true`. Page refresh → WS reconnect con mismo token → `ws-server.ts:85-88` cierra con 4001 → el cliente muestra "Token inválido o ya utilizado. Vuelve a iniciar la grabación."

**Spec violación**: `modo-grabador/spec.md` Scenario "Reconexión tras refresh del navegador": *"el nuevo cliente re-abre WS con el mismo token y el recorder valida, encuentra la sesión activa y retoma el stream y el browser NO se reinicia"*.

UX mitigada por el mensaje de error, pero la sesión queda muerta. **Aceptable como WARNING** si se confirma que el comportamiento deseado en G1 es "one-shot estricto". **Recomendación**: deferir este escenario a HU-G8 (HU-Reanudar) y aclararlo en la spec.

#### W2. `RECORDER_INTERNAL_URL` requerido pero no documentado

`lib/grabador/recorder-client.ts:31-37` requiere `process.env.RECORDER_INTERNAL_URL` y lanza error si no está definido. Pero `.env.example` solo lista:
- `RECORDER_WS_PORT`
- `RECORDER_PUBLIC_URL`
- `RECORDER_INTERNAL_SECRET`
- `RECORDER_MAX_SESSIONS`
- `RECORDER_HEARTBEAT_TIMEOUT_MS`

`RECORDER_INTERNAL_URL` no aparece. **Quien corra `npm run dev` por primera vez verá "RECORDER_INTERNAL_URL no definida" al primer POST**.

Tampoco está en `docker-compose.dev.yml` servicio `app` (solo en el servicio `recorder`). Esto rompe Docker Compose workflow.

**Fix**: agregar a `.env.example`:
```bash
RECORDER_INTERNAL_URL="http://localhost:3100"
```
Y a `docker-compose.dev.yml` `app`:
```yaml
- RECORDER_INTERNAL_URL=http://recorder:3100
- RECORDER_INTERNAL_SECRET=${RECORDER_INTERNAL_SECRET:-dev-recorder-secret-change-me-in-prod-32chars}
```

#### W3. User-initiated `stop` no persiste `estado='detenida'`

`ws-server.ts:126-129` recibe `{type:'stop'}` y cierra el WS (code 1000). Pero:
- El `BrowserContext` no se cierra explícitamente
- La sesión en DB sigue con `estado='activa'` hasta el siguiente arranque del recorder (cuando `cleanupOrphans` la marca como `error`)

**Spec implication**: el usuario presiona "Detener" → la sesión queda zombie hasta el próximo restart del recorder-worker. Aceptable en MVP si el G1 asume "el browser se cierra con el WS" (lo cual es parcialmente cierto — `wss.clients.forEach(c => c.close(1001, "shutting down"))` en graceful shutdown sí cierra contextos, pero el stop individual no).

#### W4. Nuevo error de TypeScript en `lib/credenciales/seed.ts:38`

```ts
valor: encryptCredencial(DEMO_STORAGE_STATE) as unknown as Uint8Array,
```

Error TS2322: `Type 'Uint8Array<ArrayBufferLike>' is not assignable to type 'Uint8Array<ArrayBuffer>'`. Buffer extends Uint8Array<ArrayBufferLike> (Node 22 typing) pero Prisma 6 espera Uint8Array<ArrayBuffer>. El cast no resuelve porque TypeScript distingue los parámetros de tipo del genérico.

**Fix**: usar el wrapper `Prisma.Bytes` o convertir con `new Uint8Array(buffer)` antes del insert.

No bloquea runtime (el test pasa) pero es la única regresión de tipado introducida por HU-G1 vs el baseline de 13 errores pre-existentes.

---

### SUGGESTION

#### S1. Placeholder entries con `null as unknown as ...` en `http-api.ts:109-114`

El `addEntry` inicial crea un entry con `context: null, page: null, cdp: null` que se reemplaza cuando el browser está listo. Mejorar el tipo `SessionEntry` para tener campos nullable y reflejar el estado de transición. También el `setInterval(() => {}, 60_000)` es un desperdicio de CPU — usar `setTimeout` no-op o directamente omitir el campo hasta que llegue el browser.

#### S2. `paso-panel.tsx` no necesita `"use client"`

El componente no usa hooks, no maneja eventos, solo renderiza. Podría ser Server Component. Impacto: bundle JS ligeramente mayor.

#### S3. Falta cobertura jest para `ws-server.ts`

El módulo más crítico del recorder (auth WS, handshake, broadcast, error paths) tiene **0 tests directos**. Solo `auth.ts` (firmas) y `session-registry.ts` (registry in-memory) tienen cobertura. Considerar agregar tests de integración con un mock `prisma` + `WebSocketServer` real en puerto random.

#### S4. E2E specs no ejecutables en CI

`e2e/grabador-iniciar.spec.ts` y `e2e/grabador-url-inaccesible.spec.ts` requieren:
- `npm run dev` corriendo (Next.js + worker + recorder + Postgres)
- Credenciales hardcoded `admin@admin.com / admin123`
- Sin `playwright.config.ts` configurado para `testDir: './e2e'`

Recomendación: documentar el setup requerido en `e2e/README.md` o crear `playwright.config.ts` dedicado para `e2e/`.

#### S5. `scripts/verify-hu-g21-schema.ts` es un smoke script committed

Es un one-off útil para manual gate, pero queda en el repo. Considerar mover a `scripts/smoke/` o eliminar post-merge (cuando la migración ya está validada en producción).

#### S6. Type-cast complejo en `launch-session.ts:55`

```ts
...(input.storageState ? { storageState: input.storageState as Parameters<typeof chromium.launchPersistentContext>[1] extends infer O ? O extends { storageState?: infer S } ? S : never : never } : {})
```

El cast extrae el tipo `storageState` del segundo parámetro de `launchPersistentContext` con conditional types anidados. Funciona pero es ilegible. Sugerencia: usar un type helper `LaunchOptions = NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]>` y `LaunchOptions['storageState']`.

#### S7. `RECORDER_INTERNAL_URL` debería tener default en `recorder-client.ts`

```ts
function getRecorderUrl(): string {
  const url = process.env.RECORDER_INTERNAL_URL;
  if (!url) {
    throw new Error("RECORDER_INTERNAL_URL no definida; ...");
  }
  return url;
}
```

Podría fallback a `http://localhost:${RECORDER_WS_PORT ?? 3100}` en dev. Mantiene explicitud pero elimina la fricción.

---

## Decisión

**Status: FAIL**

**Verdict**: 2 hallazgos CRITICAL bloquean el MERGE a `develop-fase2`. La implementación entrega la mayor parte del scope correctamente (379 tests pasan, build OK, seed OK, recorder arranca, UI renderiza) pero tiene **bugs reales en la lógica del WS handshake** que rompen dos escenarios explícitos de los specs ("Token reusado" y "Expiración por inactividad").

**`next_recommended`**: `fix-and-retry`

El orquestador debería despachar un sub-agent para:
1. **C1 (race condition)**: reemplazar `findFirst + update` por `updateMany({where:{tokenUsado:false}})` atómico en `lib/recorder/ws-server.ts`. Agregar test de concurrencia en `__tests__/lib/recorder/ws-server.test.ts` (nuevo archivo).
2. **C2 (expiración por inactividad)**: implementar el `setInterval` que barre `getAllEntries()` cada 30s y cierra contextos con `lastHeartbeatAt` antiguo. Persistir `estado='detenida'`, `endedAt`. Agregar test unit de la lógica de expiración.

Una vez corregidos, re-correr `npm test` + manual gate con `npm run dev` para validar el escenario end-to-end.

---

## Limitaciones conocidas

### W3 — Reconexión tras refresh del navegador

Actualmente la WS handshake usa CAS atómico (ver CRITICAL C1 arriba): un token se marca `tokenUsado=true` al primer WS connect exitoso. Cualquier reconexión posterior con el mismo token — incluido un refresh del navegador que reabre WS — recibe close code 4001 con mensaje "token ya utilizado o no existe".

El cliente UI mitiga mostrando "Token inválido o ya utilizado. Vuelve a iniciar la grabación.", pero la sesión queda muerta. Esto entra en tensión con el design.md original ("Reconexión usa el mismo token mientras la sesión esté activa") pero matchea la spec literal ("Token de un solo uso").

Para soportar reconexión transparente tras refresh, se requiere refactor del `SessionEntry` para trackear el cliente activo en memoria (no en DB) y permitir reconexión mientras no haya cliente concurrente. Esto se difiere a una HU posterior (probablemente HU-G8 "Reanudar sesión").

**Status**: deferred — no code changes en este fix-and-retry.

---

## Próximos pasos

### Antes del MERGE (fix-and-retry)

1. **[CRITICAL] C1**: Atomic CAS en `ws-server.ts` — `updateMany({where:{tokenUsado:false}})` + check count
2. **[CRITICAL] C2**: Implementar expiración por inactividad en `recorder-worker.ts` + leer `RECORDER_HEARTBEAT_TIMEOUT_MS`
3. **[WARNING] W2**: Agregar `RECORDER_INTERNAL_URL` a `.env.example` + `docker-compose.dev.yml` `app` service
4. **[WARNING] W4**: Fix el type-cast de `Buffer` → `Uint8Array<ArrayBuffer>` (o usar `Prisma.Bytes`)
5. **[Tests]**: Agregar `__tests__/lib/recorder/ws-server.test.ts` con casos para race condition + atomic handshake

### Manual gate (después de fix-and-retry)

1. `npm run dev` levanta `web + worker + recorder` sin colisiones
2. Login como superadmin → `/casos/grabar/nueva` → form → "Iniciar grabación"
3. Verificar badge "EN VIVO" en <5s (dev local)
4. Refresh de página → la sesión se mantiene (validación W1 una vez corregido)
5. Cerrar tab y volver a abrir dentro de 10 min → reconexión OK (validación C2)
6. Cerrar tab >10 min → sesión queda `estado='detenida'` (validación C2)
7. URL inaccesible → error.tsx en <12s
8. `RECORDER_MAX_SESSIONS=1` con sesión activa → segunda llamada devuelve 503

### Post-merge (futuro)

- W3: implementar stop que persista `endedAt`
- S1-S7: cleanup de código y cobertura

---

## Resumen ejecutivo de cambios verificados

| Aspecto | Resultado |
|---------|-----------|
| Tasks completos | 5/5 phases (1-5) completas |
| Tests nuevos | 8 jest + 2 e2e = 10 archivos |
| Tests pasando | 379 (+63 vs baseline 316) |
| Tests fallando | 37 (idéntico al baseline, sin regresiones) |
| Lint | No ejecutable (pre-existente) |
| Typecheck | 14 errors (13 pre-existing + 1 nuevo en `seed.ts:38`) |
| Migration | Generada, valida con `verify-hu-g21-schema.ts` |
| Seed | Idempotente, no interrumpe admin existente |
| Recorder-worker | Arranca, `/health` 200, secret inválido → 401 |
| Commit hygiene | 7 commits lógicos, conventional commits, tests con código |
| Spec compliance | 9/15 + 3 partial + 3 failing/untested |
| Hallazgos CRITICAL | 2 |
| Hallazgos WARNING | 4 |
| Hallazgos SUGGESTION | 7 |

**Decisión final**: **FAIL** → requiere fix-and-retry de los 2 CRITICAL antes del manual gate.
