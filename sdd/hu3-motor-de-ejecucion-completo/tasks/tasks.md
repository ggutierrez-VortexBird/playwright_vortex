# HU-3 — Tareas de implementación

## Resumen

27 tareas en total, organizadas en 10 grupos de capacidad.

## Grupo 1: Instalación de Playwright

### Tarea 1.1: Agregar @playwright/test como devDependency y script worker
**Archivos**: `package.json`
**Descripción**: Agregar `@playwright/test` como devDependency en `package.json` y agregar el script `"worker": "node --import tsx scripts/worker.ts"` en la sección scripts. Ejecutar `npm install` para instalar la dependencia.
**Criterio de done**: `npx playwright --version` devuelve la versión sin errores y en `package.json` aparece `"@playwright/test"` en devDependencies y el script `worker` está presente.
**AC cubierto**: AC-1, AC-3 (prerrequisito)

### Tarea 1.2: Instalar browsers de Playwright
**Archivos**: — (solo ejecución de comando)
**Descripción**: Ejecutar `npx playwright install --with-deps chromium` para instalar el browser necesario para el worker. Esto descarga Chromium y sus dependencias del sistema.
**Criterio de done**: `npx playwright install --with-deps chromium` termina sin errores. El comando `playwright --version` funciona.
**AC cubierto**: AC-1, AC-3 (prerrequisito)

### Tarea 1.3: Crear playwright.config.ts base
**Archivos**: `playwright.config.ts`
**Descripción**: Crear el archivo de configuración base con: `testDir` apuntando a `./tmp-playwright-vortex`, `timeout: 300000` (5 min), `workers: 1`, `reporter: []`, `headless: true`, `viewport: { width: 1280, height: 720 }`. Este archivo es usado por el worker al ejecutar `npx playwright test`.
**Criterio de done**: El archivo `playwright.config.ts` existe con la configuración descrita y es importable sin errores.
**AC cubierto**: AC-3 (prerrequisito)

---

## Grupo 2: Reporter custom de Playwright

### Tarea 2.1: Crear reporter custom JSON (scripts/my-reporter.js)
**Archivos**: `scripts/my-reporter.js`
**Descripción**: Crear el reporter custom de Playwright que escribe un objeto JSON por línea a stdout. Debe implementar la interfaz Reporter con `onStepEnd`, `onEnd`, `onStdOut`, `onStdErr`. El evento de paso debe incluir: `{ type: 'step', numero, descripcion, estado: 'paso'|'fallo'|'reparado', duracionMs, selfHealed }`. El evento de fin debe incluir: `{ type: 'end', estado, duracionMs }`.
**Criterio de done**: El archivo existe y cuando Playwright lo usa via `--reporter=scripts/my-reporter.js`, emite líneas JSON válidas a stdout por cada paso y al final. Validar con un script de prueba que parsee las líneas.
**AC cubierto**: AC-11

---

## Grupo 3: Helpers del worker (lib/worker)

### Tarea 3.1: Crear script-temp.ts — escritura y cleanup de archivos temporales
**Archivos**: `lib/worker/script-temp.ts`
**Descripción**: Crear helper que recibe `ejecucionId`, `script` (texto del caso) y `scriptFileName`. Escribe el script a `os.tmpdir()/playwright-vortex/<runId>-<sanitized>.spec.ts`. Debe sanitizar el nombre del archivo eliminando caracteres peligrosos. Exportar `writeTempScript(ejecucionId, script, scriptFileName): Promise<string>` (retorna la ruta del archivo) y `cleanupTempScript(tmpPath): Promise<void>` (elimina el archivo, usar en finally). La extensión forzada debe ser `.spec.ts`.
**Criterio de done**: Un test que verifica que `writeTempScript` crea un archivo en `os.tmpdir()/playwright-vortex/` con extensión `.spec.ts`, que `cleanupTempScript` lo elimina, y que dos llamadas para el mismo ejecucionId no colisionan (nombres únicos).
**AC cubierto**: AC-3, AC-7 (prerrequisito)

### Tarea 3.2: Crear validate-script.ts — validación lazy del script
**Archivos**: `lib/worker/validate-script.ts`
**Descripción**: Crear función `validateScript(script: string, scriptFileName: string | null): ValidationResult`. Reglas: (1) si `script.trim() === ''` → inválido con error 'Script vacío o no proporcionado'; (2) si `scriptFileName` existe y no termina en `.spec.ts` ni `.test.ts` → inválido con error que indica la extensión requerida; (3) si pasa ambas → válido. No intentar parsear TypeScript.
**Criterio de done**: Tests que verifican: script vacío → inválido, script con solo espacios → inválido, scriptFileName con extensión válida `.spec.ts` → válido, scriptFileName con extensión válida `.test.ts` → válido, scriptFileName con extensión inválida → inválido con mensaje descriptivo.
**AC cubierto**: AC-7

### Tarea 3.3: Crear runner.ts — spawn de Playwright y parseo de stdout
**Archivos**: `lib/worker/runner.ts`
**Descripción**: Crear `runPlaywrightTest(tmpPath: string, ejecucionId: string): Promise<PlaywrightResult>`. Debe hacer `spawn('npx', ['playwright', 'test', tmpPath, '--reporter=', reporterPath])` con `stdio: ['pipe', 'pipe', 'pipe']`. Consumir `stdout` línea por línea: `try { JSON.parse(line) } catch { continue }`. Por cada evento de tipo `step`, insertar `PasoEjecucion` en BD con los datos del evento. Al recibir `on('close')` con code 0 → `passed: true`, code 1 → `passed: false`, otro code → reject. Debe tener timeout global de 5 minutos con `setTimeout` que hace `proc.kill('SIGTERM')`.
**Criterio de done**: Un test de integración o script manual que ejecuta un script Playwright válido y verifica que: (1) se insertan registros `PasoEjecucion` en BD por cada paso emitido por el reporter, (2) la duración se mide correctamente, (3) el resultado returned indica si pasó o falló.
**AC cubierto**: AC-3, AC-11

### Tarea 3.4: Crear lock.ts — wrapper para check anti-concurrencia
**Archivos**: `lib/worker/lock.ts`
**Descripción**: Crear función `checkNoRunningExecution(prisma: Prisma.TransactionClient, casoPruebaId: string): Promise<void>` que ejecuta `SELECT ... FOR UPDATE NOWAIT` buscando ejecuciones del mismo caso con estado en `('pendiente', 'corriendo')`. Si encuentra alguna, lanza error específico que la action de API pueda convertir en 409. El error debe ser capturable y no debe ser un error genérico de Prisma.
**Criterio de done**: Test que verifica que si hay una ejecución `pendiente` para un caso, la función lanza el error esperado (no una excepción de Prisma sino un error de aplicación).
**AC cubierto**: AC-5, AC-6

---

## Grupo 4: Worker principal (scripts/worker.ts)

### Tarea 4.1: Crear worker.ts — loop principal de polling
**Archivos**: `scripts/worker.ts`
**Descripción**: Crear el worker standalone que polling-ea la BD cada 5 segundos. El loop: (1) `SELECT ... FOR UPDATE SKIP LOCKED WHERE estado='pendiente' ORDER BY createdAt ASC LIMIT 1` — obtiene siguiente job; (2) si no hay job, dormir 5s y continuar; (3) si hay job: marcar `corriendo` + `inicioAt`, llamar `validateScript`, si inválido → marcar `errorMotor` + insertar paso de error, continuar; (4) si válido: `writeTempScript`, llamar `runPlaywrightTest`, al resultado: actualizar `Ejecucion.estado` final + `finAt` + `duracionMs`, en catch: marcar `errorMotor`; (5) siempre: `cleanupTempScript`. El worker debe loguear a `console.error` (stderr) para facilitar debugging.
**Criterio de done**: El worker compila sin errores TypeScript y cuando se ejecuta con `npm run worker` (con una ejecución `pendiente` en BD): (1) la marca como `corriendo`, (2) la procesa, (3) al terminar actualiza el estado final. Verificar que no deja archivos temporales huérfanos.
**AC cubierto**: AC-2, AC-3, AC-7, AC-8

---

## Grupo 5: Capa de datos (lib/ejecuciones)

### Tarea 5.1: Crear queries.ts — consultas Prisma
**Archivos**: `lib/ejecuciones/queries.ts`
**Descripción**: Implementar `getEjecucionConPasos(id: string)` que hace `findUnique` con `include` de `casoPrueba` (select id, nombre, codigo, proyectoId) y `pasos` (orderBy numero asc). Implementar `listEjecuciones(proyectoId?: string)` que hace `findMany` con `include` de `casoPrueba` (con proyecto anidado: nombre) y un paso reciente (select id, orderBy createdAt desc, take 1), ordenados por `createdAt` desc.
**Criterio de done**: Tests que verifican: `getEjecucionConPasos` retorna la ejecución con pasos ordenados por número asc, `listEjecuciones` agrupa/ejecuciones por proyecto y incluye el último paso de cada ejecución.
**AC cubierto**: AC-4, AC-9, AC-11

### Tarea 5.2: Crear actions.ts — dispararEjecucion con lock NOWAIT
**Archivos**: `lib/ejecuciones/actions.ts`
**Descripción**: Implementar `dispararEjecucion(casoPruebaId: string): Promise<{ id: string; estado: string }>` dentro de `prisma.$transaction`. Primero ejecuta `checkNoRunningExecution` (del grupo de lock). Si pasa, crea `Ejecucion` con `estado: 'pendiente'`. Devuelve el id y estado. Si el caso no existe, lanzar error 404. Manejar el error de lock (P2024 o `lock_not_available`) y convertirlo en 409.
**Criterio de done**: Tests que verifican: (1) `dispararEjecucion` inserta una ejecución con estado `pendiente` y retorna el id, (2) si ya hay una ejecución en curso, lanza error 409 (no inserta nada), (3) si el caso no existe, lanza 404.
**AC cubierto**: AC-1, AC-5, AC-6

---

## Grupo 6: API Routes

### Tarea 6.1: Crear POST /api/ejecuciones (route.ts)
**Archivos**: `app/api/ejecuciones/route.ts`
**Descripción**: Crear Route Handler que recibe `POST` con body `{ casoPruebaId }`. Valida que el usuario es superadmin (getSession + requireSuperadmin). Delega a `dispararEjecucion` de `lib/ejecuciones/actions.ts`. Retorna 201 con `{ id, estado: 'pendiente' }`. Maneja errores: 400 (script vacío — aunque esto se valida en worker, el server action debe verificar que el caso existe), 403 (no superadmin), 404 (caso no existe), 409 (concurrencia).
**Criterio de done**: El endpoint responde correctamente a: POST válido → 201 + { id, estado }, POST sin ser superadmin → 403, POST con caso inexistente → 404, POST concurrente → 409.
**AC cubierto**: AC-1, AC-5, AC-6

### Tarea 6.2: Crear GET /api/ejecuciones/[id] (route.ts)
**Archivos**: `app/api/ejecuciones/[id]/route.ts`
**Descripción**: Crear Route Handler que recibe `GET`. Llama a `getEjecucionConPasos(id)` de queries. Si no existe, retorna 404. Retorna la ejecución completa con pasos ordenados. Debe usar `cache: 'no-store'` en el fetch del cliente para evitar caché.
**Criterio de done**: GET a un id existente → 200 con JSON de la ejecución + pasos. GET a id inexistente → 404. El response no tiene caché (headers appropriate).
**AC cubierto**: AC-2, AC-9, AC-11

### Tarea 6.3: Crear GET /api/ejecuciones (route.ts) — listado global
**Archivos**: `app/api/ejecuciones/route.ts`
**Descripción**: Crear Route Handler que recibe `GET` con query opcional `?proyectoId=`. Llama a `listEjecuciones(proyectoId)` y retorna la lista de ejecuciones con datos del caso y proyecto.
**Criterio de done**: GET /api/ejecuciones → 200 con array de ejecuciones agrupadas por proyecto (gracias a include en queries). GET /api/ejecuciones?proyectoId=xxx → filtra por proyecto.
**AC cubierto**: AC-4

---

## Grupo 7: Componentes UI

### Tarea 7.1: Crear ejecutar-button.tsx
**Archivos**: `components/ejecuciones/ejecutar-button.tsx`
**Descripción**: Componente `'use client'` con el botón "Ejecutar". Props: `casoPruebaId: string`. Al hacer click: muestra estado de loading (spinner), hace `POST /api/ejecuciones` con `{ casoPruebaId }`. Si responde 201: redirige a `/ejecuciones/[id]`. Si responde 409: muestra mensaje de error de concurrencia en UI (toast o mensaje inline). Si hay error de red: muestra error. El botón debe estar deshabilitado mientras está en estado de loading.
**Criterio de done**: El botón se renderiza correctamente, muestra loading al hacer click, redirige a /ejecuciones/[id] tras éxito, y muestra mensaje de error cuando la respuesta es 409.
**AC cubierto**: AC-1, AC-5

### Tarea 7.2: Crear ejecucion-status.tsx (pill con color según estado)
**Archivos**: `components/ejecuciones/ejecucion-status.tsx`
**Descripción**: Componente que recibe `estado: Ejecucion['estado']` y renderiza un div con clase `.pill` más la clase de color correspondiente: `.p-idle` (gris) para `pendiente`, `.p-running` (azul) para `corriendo`, `.p-pass` (verde) para `paso`, `.p-fail` (rojo) para `fallo`, `.p-heal` (ámbar) para `reparado`, `.stamp` (sello rojo inclinado) para `errorMotor`. Debe aceptar `className` extra para permitir override.
**Criterio de done**: El componente renderiza el badge con el color correcto para cada uno de los 6 estados. Visualmente coincide con la tabla de estados del spec.
**AC cubierto**: AC-2, AC-3

### Tarea 7.3: Crear pasos-list.tsx (lista de pasos con highlight)
**Archivos**: `components/ejecuciones/pasos-list.tsx`
**Descripción**: Componente `'use client'` que recibe `pasos: PasoEjecucion[]` y `freshStepIds: Set<string>`. Renderiza la lista tipo `.ledger` con filas `.rstep`. Cada fila tiene grid de 3 columnas: número, descripción, duración. Si el paso está en `freshStepIds`, agregar clase `.new` que activa la animación CSS de highlight. Variantes de color: `.fail` (fondo `#FCF3F2`) para estado `fallo`, `.heal` (fondo `#FCF8EE`) para estado `reparado`. Mostrar duración en ms si está disponible.
**Criterio de done**: La lista renderiza todos los pasos con el formato correcto. Los pasos con `freshStepIds` tienen la clase `.new`. Los estados `fallo` y `reparado` tienen los colores de fondo correctos.
**AC cubierto**: AC-9, AC-10, AC-11

### Tarea 7.4: Crear ejecucion-summary.tsx
**Archivos**: `components/ejecuciones/ejecucion-summary.tsx`
**Descripción**: Componente que recibe la ejecución completa y muestra: estado (usando `ejecucion-status`), duración formateada (`duracionMs` en segundos o ms), `inicioAt` y `finAt` formateados como timestamp legible. Si `errorMsg` existe, mostrar el mensaje de error del motor.
**Criterio de done**: El resumen muestra todos los campos correctamente formateados para ejecuciones en cualquier estado, incluyendo `errorMotor` con su mensaje.
**AC cubierto**: AC-3

### Tarea 7.5: Crear error-motor-badge.tsx
**Archivos**: `components/ejecuciones/error-motor-badge.tsx`
**Descripción**: Componente para mostrar el estado `errorMotor` con un sello rojo inclinado (`.stamp`). Debe recibir `errorMsg: string | null` y renderizar: el sello con texto "ERROR MOTOR" inclinado, y debajo (o al lado) el mensaje de error descriptivo. El sello debe usar color rojo `--stamp` (#A8322A).
**Criterio de done**: El badge renderiza un sello rojo inclinado con "ERROR MOTOR" y muestra el mensaje de error del motor de forma legible.
**AC cubierto**: AC-7, AC-8

---

## Grupo 8: Páginas de UI

### Tarea 8.1: Crear página global /ejecuciones (page.tsx)
**Archivos**: `app/(dashboard)/ejecuciones/page.tsx`
**Descripción**: Server Component que hace `listEjecuciones()` (sin filtro de proyecto) y renderiza la vista global de ejecuciones agrupadas por proyecto. Cada grupo de proyecto muestra las ejecuciones del caso con: nombre del caso, estado (pill), resultado, fecha. Al hacer clic en una fila se navega a `/ejecuciones/[id]`. Usar el diseño del mockup con `.ledger` y filas `.rstep`.
**Criterio de done**: La página renderiza todas las ejecuciones agrupadas por proyecto. Cada fila es clickeable y navega al detalle. La página funciona como Server Component puro (sin 'use client').
**AC cubierto**: AC-4

### Tarea 8.2: Crear loading.tsx y error.tsx para /ejecuciones
**Archivos**: `app/(dashboard)/ejecuciones/loading.tsx`, `app/(dashboard)/ejecuciones/error.tsx`
**Descripción**: `loading.tsx` debe ser un componente de loading (spinner o skeleton) que se muestra mientras la página carga. `error.tsx` debe ser un error boundary que muestra un mensaje de error y permite reintentar.
**Criterio de done**: Al navegar a /ejecuciones, el loading se muestra primero (si es lento), y si hay error de servidor se muestra el error boundary en lugar de una página en blanco.
**AC cubierto**: AC-4

### Tarea 8.3: Crear página de detalle /ejecuciones/[id] (page.tsx)
**Archivos**: `app/(dashboard)/ejecuciones/[id]/page.tsx`
**Descripción**: Server Component que recibe `params.id`. Hace `getEjecucionConPasos(id)`. Si no existe, mostrar not-found. Renderiza: topbar con título "Ejecución #[id]", breadcrumb con nombre del caso, `ejecucion-status` con el estado actual, `ejecucion-summary` con duración y timestamps, y el componente `ejecucion-client.tsx` que maneja el polling. Debe importar `EjecucionClient` dinámicamente si es necesario para el streaming.
**Criterio de done**: La página muestra el detalle completo de la ejecución con todos sus pasos. Funciona como Server Component para el fetch inicial.
**AC cubierto**: AC-2, AC-3, AC-9, AC-10, AC-11

### Tarea 8.4: Crear ejecucion-client.tsx (polling 2s y highlight)
**Archivos**: `app/(dashboard)/ejecuciones/[id]/ejecucion-client.tsx`
**Descripción**: Componente `'use client'` que recibe `initialData: EjecucionConPasos` y `ejecucionId`. Implementa polling cada 2s con `setInterval` dentro de `useEffect`. El efecto hace `fetch /api/ejecuciones/[id]` con `cache: 'no-store'`. Detecta pasos nuevos comparando ids con el estado previo. Para cada paso nuevo: lo añade a `freshStepIds` Set. Usa `setTimeout(2000ms)` para remover el highlight después de ~2s. Renderiza `EjecucionSummary` y `PasosList` con los pasos y el Set de fresh ids. Detiene el polling cuando el estado es terminal (`pendiente` o `corriendo` son los únicos no-terminales). Cleanup del `setInterval` al desmontar.
**Criterio de done**: El componente hace polling cada 2s, detecta pasos nuevos, los marca con highlight, y deja de hacer polling cuando la ejecución termina. Los pasos nuevos aparecen visualmente destacados durante ~2s y luego el highlight se remueve automáticamente.
**AC cubierto**: AC-2, AC-9, AC-10

### Tarea 8.5: Agregar botón "Ejecutar" en casos-client.tsx
**Archivos**: `app/(dashboard)/casos/casos-client.tsx` (o archivo equivalente de lista de casos)
**Descripción**: En la vista de lista de casos (o en la vista de detalle del caso), agregar el componente `EjecutarButton` en cada fila de caso o en la vista de detalle del caso. El botón debe estar visible para superadministradores y pasar el `casoPruebaId` correspondiente. Ubicar el botón en la columna de acciones de la fila, o junto al nombre del caso en la vista de detalle.
**Criterio de done**: El botón "Ejecutar" aparece en la UI junto a cada caso de prueba. Al hacer click, se dispara la ejecución y se redirige al usuario a la página de detalle de la ejecución creada.
**AC cubierto**: AC-1

---

## Grupo 9: Docker y scripts de inicio

### Tarea 9.1: Actualizar docker-compose.yml para incluir el worker
**Archivos**: `docker-compose.yml`
**Descripción**: Asegurar que el servicio del worker se inicia junto con la aplicación. Esto puede ser: (a) agregando un servicio `worker` que ejecuta `npm run worker` con acceso a `node_modules` y al mismo `DATABASE_URL`, o (b) modificando el entrypoint del contenedor de la app para que ejecute el worker como sidecar. Asegurar que el volumen de `node_modules` está disponible para el worker (para que pueda ejecutar `npx playwright test`).
**Criterio de done**: Al hacer `docker-compose up`, tanto la app Next.js como el worker están corriendo. El worker tiene acceso a la BD y puede ejecutar Playwright.
**AC cubierto**: AC-2, AC-3 (prerrequisito de infraestructura)

---

## Grupo 10: Tests

### Tarea 10.1: Tests unitarios de lib/worker y lib/ejecuciones
**Archivos**: `lib/worker/lock.test.ts`, `lib/worker/script-temp.test.ts`, `lib/worker/validate-script.test.ts`, `lib/ejecuciones/actions.test.ts`, `lib/ejecuciones/queries.test.ts`
**Descripción**: Crear tests unitarios con Jest o el test runner del proyecto para: (1) `validate-script`: script vacío → inválido, extensiones válidas → válido; (2) `script-temp`: escritura a tmpdir, nombre único, cleanup; (3) `lock`: segunda ejecución concurrente → lanza error de lock; (4) `actions`: INSERT pendiente retorna id, caso inexistente → 404; (5) `queries`: pasos ordenados por número, list con proyecto anidado.
**Criterio de done**: `npm test` (o el comando de tests del proyecto) pasa sin errores para todos los archivos de test. Cada test verifica el criterio de done de la tarea correspondiente.
**AC cubierto**: AC-5, AC-6, AC-7, AC-8

### Tarea 10.2: Tests E2E de ejecuciones y concurrencia
**Archivos**: `e2e/ejecuciones.spec.ts`, `e2e/concurrency.spec.ts`
**Descripción**: Crear tests E2E con Playwright: (1) `ejecuciones.spec.ts`: crear un caso con script válido → hacer click en Ejecutar → verificar que se redirige a /ejecuciones/[id] → esperar a que el estado cambie a `paso` o `fallo` → verificar que los pasos aparecen en la UI y reflejan lo que el worker emitió; (2) `concurrency.spec.ts`: crear un caso → ejecutar → intentar ejecutar el mismo caso por segunda vez antes de que termine → verificar que la segunda respuesta es 409.
**Criterio de done**: Los tests E2E corren con `npx playwright test` y pasan. El test de concurrencia verifica que el segundo disparo recibe 409. El test de flujo completo verifica el ciclo de vida de la ejecución.
**AC cubierto**: AC-1, AC-2, AC-3, AC-5, AC-6, AC-9, AC-10, AC-11

---

## Tabla resumen

| # | Tarea | Grupo | AC(s) cubierto(s) | Estado |
|---|-------|-------|-------------------|--------|
| 1.1 | Agregar @playwright/test como devDependency y script worker | Grupo 1: Playwright | AC-1, AC-3 (prerreq) | pending |
| 1.2 | Instalar browsers de Playwright | Grupo 1: Playwright | AC-1, AC-3 (prerreq) | pending |
| 1.3 | Crear playwright.config.ts base | Grupo 1: Playwright | AC-3 (prerreq) | pending |
| 2.1 | Crear reporter custom JSON (scripts/my-reporter.js) | Grupo 2: Reporter | AC-11 | pending |
| 3.1 | Crear script-temp.ts (escritura y cleanup de archivos) | Grupo 3: Worker helpers | AC-3, AC-7 | pending |
| 3.2 | Crear validate-script.ts (validación lazy) | Grupo 3: Worker helpers | AC-7 | pending |
| 3.3 | Crear runner.ts (spawn Playwright, parse stdout) | Grupo 3: Worker helpers | AC-3, AC-11 | pending |
| 3.4 | Crear lock.ts (check anti-concurrencia) | Grupo 3: Worker helpers | AC-5, AC-6 | pending |
| 4.1 | Crear worker.ts (loop principal de polling) | Grupo 4: Worker | AC-2, AC-3, AC-7, AC-8 | pending |
| 5.1 | Crear queries.ts (getEjecucionConPasos, listEjecuciones) | Grupo 5: Datos | AC-4, AC-9, AC-11 | pending |
| 5.2 | Crear actions.ts (dispararEjecucion con lock NOWAIT) | Grupo 5: Datos | AC-1, AC-5, AC-6 | pending |
| 6.1 | Crear POST /api/ejecuciones | Grupo 6: API Routes | AC-1, AC-5, AC-6 | pending |
| 6.2 | Crear GET /api/ejecuciones/[id] | Grupo 6: API Routes | AC-2, AC-9, AC-11 | pending |
| 6.3 | Crear GET /api/ejecuciones (listado global) | Grupo 6: API Routes | AC-4 | pending |
| 7.1 | Crear ejecutar-button.tsx | Grupo 7: UI Components | AC-1, AC-5 | pending |
| 7.2 | Crear ejecucion-status.tsx (pill con color) | Grupo 7: UI Components | AC-2, AC-3 | pending |
| 7.3 | Crear pasos-list.tsx (lista con highlight) | Grupo 7: UI Components | AC-9, AC-10, AC-11 | pending |
| 7.4 | Crear ejecucion-summary.tsx | Grupo 7: UI Components | AC-3 | pending |
| 7.5 | Crear error-motor-badge.tsx | Grupo 7: UI Components | AC-7, AC-8 | pending |
| 8.1 | Crear página global /ejecuciones | Grupo 8: Pages | AC-4 | pending |
| 8.2 | Crear loading.tsx y error.tsx para /ejecuciones | Grupo 8: Pages | AC-4 | pending |
| 8.3 | Crear página de detalle /ejecuciones/[id] | Grupo 8: Pages | AC-2, AC-3, AC-9, AC-10, AC-11 | pending |
| 8.4 | Crear ejecucion-client.tsx (polling 2s, highlight) | Grupo 8: Pages | AC-2, AC-9, AC-10 | pending |
| 8.5 | Agregar botón "Ejecutar" en casos-client.tsx | Grupo 8: Pages | AC-1 | pending |
| 9.1 | Actualizar docker-compose.yml para worker | Grupo 9: Docker | AC-2, AC-3 (infra) | pending |
| 10.1 | Tests unitarios de lib/worker y lib/ejecuciones | Grupo 10: Tests | AC-5, AC-6, AC-7, AC-8 | pending |
| 10.2 | Tests E2E de ejecuciones y concurrencia | Grupo 10: Tests | AC-1, AC-2, AC-3, AC-5, AC-6, AC-9, AC-10, AC-11 | pending |
