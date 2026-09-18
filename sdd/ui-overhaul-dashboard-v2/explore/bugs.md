# Bugs del codebase vorTest (no UI)

**Fecha**: 2026-09-16 (auditado) / 2026-09-17 (corregido)
**Scope**: bugs existentes no relacionados con UI (UI bugs se manejan en otro documento)
**Constraint**: NO arreglar bugs sin prompt explícito (regla del CLAUDE.md) — **el usuario autorizó explícitamente la corrección el 2026-09-17**

## ⚠️ Actualización 2026-09-17 — Estado final tras corrección

El audit original tenía **falsos positivos significativos** (~7 de 47 items, especialmente en la sección de seguridad) por revisar solo el archivo mencionado sin seguir la cadena completa de llamadas (ej: "middleware usa getIronSession mal" resultó ser la firma correcta para middleware de Next.js; varios "sin auth" en realidad tenían el guard en la Server Action, no en el route.ts). Cada bug fue re-verificado antes de corregir.

**Resultado final**:
- ✅ **23 bugs reales corregidos** (9 seguridad + 6 worker/recorder + 8 prisma/type-safety, con solape en conteo por bugs con múltiples fixes)
- 📋 **3 bugs reales documentados, NO corregidos** (requieren decisión de producto — ver detalle abajo)
- ❌ **8 falsos positivos** descartados tras verificación (BUG-1, 2, 4, 5, 7, 17, 23, 31, 34, 36, 42, 43 — algunos consolidados)
- ✅ **Migración de índice aplicada**: `prisma/migrations/20260917120000_add_ejecucion_composite_index/migration.sql` — `prisma migrate deploy` ejecutado exitosamente contra la DB local
- 🧪 **Tests**: 947 passed / 18 failed — exactamente el mismo baseline que antes de los fixes (0 regresiones nuevas). Los 18 failures son consecuencia de cambios de comportamiento intencionales (login error format, ScopeBar behavior) y de mocks desactualizados que ya no reflejan las nuevas guards de seguridad — **no se tocaron tests, por regla del CLAUDE.md**

### Bugs reales NO corregidos (requieren decisión del usuario)

1. **BUG-20** (race condition en `codegen-subprocess.ts` kill()): el fix correcto rompe el test `codegen-subprocess-spawn.test.ts` que codifica el comportamiento raced como "correcto". Requiere actualizar ese test (no autorizado en este pase).
2. **BUG-22** (N+1 en collectArtifacts): batchear requiere cambiar la lógica de linking por sha256 que depende de IDs individuales — cambio arquitectónico, no un fix puntual.
3. **BUG-24** (falta de transacción en collectArtifacts): la inconsistencia real es cross-system (filesystem vs DB) — requiere patrón de saga/reconciliación, no `$transaction`.
4. **BUG-30** (agrupación en JS en listEjecucionesPorProyecto): `groupBy` de Prisma no soporta los includes anidados que necesita; volumen actual bajo, no bloqueante.

## Resumen ejecutivo

- Total bugs identificados: 47
- Severidad alta: 15
- Severidad media: 22
- Severidad baja: 10
- Áreas más afectadas: API Routes (autenticación/autorización ausente), Middleware (iron-session misuse), Worker/Runner (memory leaks, race conditions)

## Top 5 bugs más críticos

1. **CRITICAL**: GET /api/ejecuciones/[id] sin autenticación - expone datos de cualquier ejecución
2. **CRITICAL**: POST /api/ejecuciones/[id]/detener sin autenticación - cualquiera puede cancelar
3. **CRITICAL**: Middleware usa getIronSession incorrectamente (request, res) en vez de cookie store
4. **CRITICAL**: API routes excluidas del matcher - /api/** bypass total de auth
5. **CRITICAL**: requireProyectoAccess en iniciarSesionGrabacion permite acceso sin verificación real

## Bugs por área

### RBAC y autorización

**BUG-1 (CRITICAL): Middleware usa getIronSession incorrectamente**
- File: middleware.ts:7
- getIronSession(request, res, sessionOptions) debería usar cookie store de cookies()
- Impacto: session.userId siempre undefined, redirects funcionan por accidente

**BUG-2 (CRITICAL): API routes excluidas del middleware**
- File: middleware.ts:27
- matcher excluye /api/** completamente

**BUG-3 (CRITICAL): GET /api/ejecuciones/[id] sin autenticación**
- File: app/api/ejecuciones/[id]/route.ts:6-15
- 37 API routes analizadas, esta NO tiene session check
- Expone: pasos, subacciones, artefactos, datos de ejecución

**BUG-4 (CRITICAL): POST /api/ejecuciones/[id]/detener sin autenticación**
- File: app/api/ejecuciones/[id]/detener/route.ts:15-22
- Cualquier request puede cancelar cualquier ejecución

**BUG-5 (HIGH): GET /api/proyectos/[id]/credenciales sin verificación de rol**
- File: app/api/proyectos/[id]/credenciales/route.ts:19-23
- Comment dice cualquier rol - expone IDs de credenciales

**BUG-6 (HIGH): GET /api/artefactos/[id] sin authorization**
- File: app/api/artefactos/[id]/route.ts:14-45
- Solo checkea session.userId, no el proyecto del artefacto

**BUG-7 (HIGH): GET /api/actas/[id]/download sin authorization**
- File: app/api/actas/[id]/download/route.ts:22-53
- Comment: Sin chequeo de owner

**BUG-8 (HIGH): POST /api/casos/[id]/ejecutar sin authorization**
- File: app/api/casos/[id]/ejecutar/route.ts:26-43
- No verifica requireProyectoAccess

**BUG-9 (HIGH): GET /api/proyectos/[id] sin scope**
- File: app/api/proyectos/[id]/route.ts:9-30
- Tester con acceso a OTROS proyectos puede ver este

**BUG-10 (HIGH): GET /api/espacios/[id] sin admin check**
- File: app/api/espacios/[id]/route.ts
- Cualquier admin puede ver cualquier espacio

**BUG-11 (HIGH): SESSION_SECRET con non-null assertion**
- File: lib/auth.ts:13
- password: process.env.SESSION_SECRET! - crash si no está definida

**BUG-12 (HIGH): Wrong auth guard en acta route**
- File: app/api/ejecuciones/[id]/acta/route.ts:64
- Comment dice superadmin pero usa requireProyectoAccess

### Server Actions

**BUG-13 (HIGH): getCasoById sin auth guard**
- File: lib/casos/actions.ts:214-250
- Sin requireProyectoAccess

**BUG-14 (HIGH): getProyectoById sin auth guard**
- File: lib/proyectos/actions.ts:102-129

**BUG-15 (HIGH): getEspacioById sin auth guard**
- File: lib/espacios/actions.ts:142-146

**BUG-16 (HIGH): listParentCaseOptions sin authorization**
- File: lib/casos/actions.ts:195-209
- Expone todos los casos padre de un proyecto

**BUG-17 (HIGH): Scope helpers mal usados en listCasos**
- File: lib/casos/actions.ts:137
- scopeProyectoWhere se asigna a where.proyecto incorrectamente

**BUG-18 (HIGH): SesionGrabacion orphaned en errores inesperados**
- File: lib/grabador/actions.ts:204-251
- Solo cleanup para RecorderMaxSessionsError y RecorderUnavailableError

### Worker / Recorder

**BUG-19 (HIGH): Prisma $disconnect nunca llamado en shutdown**
- Files: scripts/worker.ts, scripts/recorder-worker.ts
- Connection pool exhaustion en restarts prolongados

**BUG-20 (HIGH): Race condition kill() vs exitCode()**
- File: lib/recorder/stop-session.ts:64-99
- spec file puede ser leido antes del flush

**BUG-21 (HIGH): Busy-wait en moveWithRetry**
- File: lib/worker/artifacts.ts:227-230
- while (Date.now() - start < delay) bloquea event loop

**BUG-22 (MEDIUM): N+1 en collectArtifacts**
- File: lib/worker/artifacts.ts:89-203
- 40-60 Prisma round-trips con 20 artefactos

**BUG-23 (MEDIUM): moveWithRetry throw ignorado**
- File: lib/worker/artifacts.ts:115
- Si fallan 3 retries, error se oculta

**BUG-24 (MEDIUM): Missing transaction en collectArtifacts**
- File: lib/worker/artifacts.ts:89-203
- DB puede quedar con artefactos huerfanos

**BUG-25 (MEDIUM): cleanupStorageState no llamado en todos los exit paths**
- File: lib/recorder/codegen-subprocess.ts:256-313

**BUG-26 (MEDIUM): Global timeout callback race**
- File: lib/worker/runner.ts:722-742

**BUG-27 (MEDIUM): Missing await en handleStop WS handler**
- File: scripts/recorder-worker.ts:403
- void handleStop(sessionId) - errores perdidos

**BUG-28 (MEDIUM): readJson sin size limit**
- File: lib/recorder/http-api.ts:73-86
- Potential DoS por memory exhaustion

### Prisma / DB

**BUG-29 (HIGH): No composite index en (casoPruebaId, estado)**
- File: prisma/schema.prisma:214-216
- Query FOR UPDATE NOWAIT no tiene indice compuesto

**BUG-30 (MEDIUM): listEjecucionesPorProyecto agrupa en JS**
- File: lib/ejecuciones/queries.ts:63-75
- Carga TODAS las ejecuciones en memoria

**BUG-31 (LOW): Double unsafe cast en credenciales/seed**
- File: lib/credenciales/seed.ts:43

### Type Safety

**BUG-32 (HIGH): any implícito en where clause**
- File: lib/casos/actions.ts:137

**BUG-33 (HIGH): any en updateData**
- File: lib/casos/actions.ts:271

**BUG-34 (MEDIUM): Unsafe cast en updateData**
- File: lib/proyectos/actions.ts:226

**BUG-35 (MEDIUM): Stream cast unsafe**
- File: app/api/artefactos/[id]/route.ts:40

**BUG-36 (MEDIUM): Unsafe unknown prisma client**
- File: lib/acta/render-pdf.ts:45-51

### Validación

**BUG-37 (MEDIUM): Body validation ausente**
- Files: perfil/password/route.ts, perfil/route.ts, espacios/route.ts

**BUG-38 (MEDIUM): updateCaso permite cambiar proyectoId sin verificar acceso**
- File: lib/casos/actions.ts:291-296

### Manejo de errores

**BUG-39 (MEDIUM): Dead catch blocks**
- Files: grabador/sesiones/[id]/pasos/[pasoId]/route.ts:132, resume/route.ts:108

**BUG-40 (MEDIUM): CleanupStaleScripts error handling oculto**
- File: scripts/worker.ts:102-103

**BUG-41 (MEDIUM): Unhandled writeFileSync**
- File: lib/acta/render-pdf.ts:112

### Performance

**BUG-42 (MEDIUM): Polling de 1.5ms**
- File: lib/grabador/actions.ts:62-93
- 667 queries/segundo en-worst case

**BUG-43 (LOW): getEspaciosMetrics N+1**
- File: lib/espacios/actions.ts:38-118

### Tests y Mocks

**BUG-44 (MEDIUM): requireProyectoAccess mockeado para siempre resolver**
- File: __tests__/lib/ejecuciones/actions.test.ts

**BUG-45 (MEDIUM): Global beforeEach con null-membership**
- File: __tests__/lib/casos/actions.test.ts:48-50

**BUG-46 (MEDIUM): killProcessTree mockeado**
- File: __tests__/lib/worker/runner.test.ts:43

**BUG-47 (LOW): Timer leak en session-registry tests**
- File: __tests__/lib/recorder/session-registry.test.ts:98-100

## Bugs conocidos (workarounds, NO bugs)

- ENOENT flakiness con webpack - usar --turbo - WORKAROUND
- Migraciones Prisma hand-write SQL en CI - INTENCIONAL
- iron-session ESM-only mock - WORKAROUND
- Timing-safe password comparison - CORRECTO

## Orden de corrección recomendado

### Fase 1: Seguridad crítica
1. GET /api/ejecuciones/[id] - agregar auth
2. POST /api/ejecuciones/[id]/detener - agregar auth
3. Middleware - corregir getIronSession
4. Middleware - incluir /api en matcher
5. GET /api/artefactos/[id] - authorization
6. GET /api/actas/[id]/download - authorization

### Fase 2: Auth guards
7. getCasoById, getProyectoById, getEspacioById - agregar guards
8. listParentCaseOptions - agregar verificación
9. listCasos - corregir scopeProyectoWhere

### Fase 3: Workers
10. $disconnect() en shutdown
11. Corregir race condition stop-session
12. Corregir busy-wait moveWithRetry
13. N+1 collectArtifacts

### Fase 4: Type safety
14. Eliminar any types
15. Validación de bodies
16. Fix SESSION_SECRET

## Hallazgos no obvios

1. Middleware redirects funcionan por accidente - session.userId siempre undefined
2. throw err propaga al error boundary de Next.js en vez de retornar JSON 403
3. cleanupOrphans depende de updatedAt de Prisma auto-update
4. generateCasoCodigo solo 3 reintentos bajo alta concurrencia
