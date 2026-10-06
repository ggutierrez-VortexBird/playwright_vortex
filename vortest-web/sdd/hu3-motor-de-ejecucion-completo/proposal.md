# HU-3 — Propuesta: Motor de ejecución Playwright

## Resumen ejecutivo

La HU-3 implementa el motor de ejecución de pruebas Playwright como proceso desatendido (worker). El sistema permite disparar ejecuciones desde la UI, impide carreras de concurrencia sobre el mismo caso de prueba, muestra pasos en streaming sin recarga, y reporta errores del motor de forma clara. El worker es un script Node.js standalone que polling-ea la base de datos cada 5 segundos, ejecuta Playwright con un reporter custom que emite JSON por stdout, y persiste cada paso en `PasoEjecucion` en tiempo real. El cliente consume los pasos via polling HTTP cada 2 segundos.

---

## Decisiones de diseño propuestas

### Decisión 1: Worker como script Node.js standalone

**Opción elegida**: `scripts/playwright-worker.ts` — proceso Node.js independiente del proceso Next.js, que polling-ea la base de datos cada 5 segundos.

**Alternativas consideradas**:
- Route handler de Next.js con auto-invocación: mezclaba responsabilidades y no escala.
- Microservicio separado: overkill para MVP, introduce latencia de red y complejidad de deploy.
- Worker corriendo dentro del contenedor Next.js standalone: el output standalone de Next.js no incluye scripts personalizados; el contenedor solo tiene el built de la app.

**Justificación**: El proyecto usa `output: "standalone"` en `next.config.ts`, lo que significa que el contenedor solo contiene el build de Next.js. Un script en `scripts/` se ejecuta fuera del contenedor, o se copia al contenedor via un `ENTRYPOINT` personalizado en el Dockerfile. El polling de 5 segundos es aceptable para un sistema de ejecución de tests (no se requiere latencia sub-segundo).

**Riesgo**: Si el worker se detiene, las ejecuciones pendientes se quedan huérfanas en estado `pendiente`. Mitigación: el worker reinicia automáticamente via supervisor (Docker `restart: unless-stopped` o PM2).

**Archivos**:
- `scripts/playwright-worker.ts` — worker principal
- `scripts/playwright-reporter.js` — reporter custom de Playwright (emitido a stdout)
- `Dockerfile` / `docker-compose.yml` — arranqye del worker junto con Next.js

---

### Decisión 2: Streaming de pasos via polling HTTP del cliente cada 2 segundos

**Opción elegida**: El cliente hace `GET /api/ejecuciones/[id]` cada 2 segundos. El endpoint retorna la ejecución con sus `pasos` ordenados por número. El highlight visual de "recién agregado" (AC-10) se implementa en el cliente comparando `createdAt` de cada paso con `Date.now() - 2000ms`.

**Alternativas consideradas**:
- SSE (Server-Sent Events): Prisma no soporta `LISTEN/NOTIFY` de Postgres. SSE requeriría un message queue externo (BullMQ, RabbitMQ) para coordinar la escritura del worker con la lectura del cliente SSE. Sobreingeniería para MVP.
- WebSockets: Misma problemática de coordinación sin un broker de mensajes.
- Polling con archivo de eventos en disco: el worker escribe a un archivo, el route handler sirve `ReadableStream` desde ahí. Problemas de concurrencia de lectura/escritura y limpieza del archivo.

**Justificación**: Es la implementación más simple y coherente con el stack actual (Next.js + Prisma). Prisma no tiene API para notificaciones Postgres, y no hay message queue en el proyecto. Un intervalo de 2 segundos es imperceptible para el usuario. El highlight de 2 segundos se maneja con CSS transition + JavaScript `setTimeout`.

**Riesgo**: Polling excesivo podría saturar el servidor con muchas ejecuciones concurrentes. Mitigación: 2 segundos es conservador; se puede subir a 5 segundos si el volumen lo requiere.

**Archivos**:
- `app/api/ejecuciones/[id]/route.ts` — GET retorna ejecución con pasos
- `app/(dashboard)/ejecuciones/[id]/page.tsx` — página de detalle con componente cliente de polling
- `app/(dashboard)/ejecuciones/[id]/ejecucion-client.tsx` — componente con `setInterval` de 2s

---

### Decisión 3: Lock de concurrencia con `SELECT FOR UPDATE NOWAIT` en transacción Prisma

**Opción elegida**: Verificar atomariamente si existe una ejecución `pendiente` o `corriendo` para el mismo `casoPruebaId` usando `FOR UPDATE NOWAIT` dentro de una transacción Prisma. Si existe, devolver `409 Conflict`. Si no, crear la nueva ejecución en el mismo transaction.

**Código**:
```typescript
const result = await prisma.$transaction(async (tx) => {
  const running = await tx.$queryRaw<Ejecucion[]>(
    sql`SELECT id FROM "Ejecucion" 
        WHERE "casoPruebaId" = ${casoPruebaId} 
        AND estado IN ('pendiente', 'corriendo')
        FOR UPDATE NOWAIT`
  );
  if (running.length > 0) {
    throw { status: 409, body: { error: 'conflict', message: 'Ya existe una ejecución en curso para este caso' } };
  }
  return tx.ejecucion.create({ data: { casoPruebaId, estado: 'pendiente' } });
});
```

**Alternativas consideradas**:
- Redis SETNX: no hay Redis en el stack. Agregarlo introduce una dependencia nueva.
- Timestamps en la aplicación: no es atómico; race conditions posibles.
- Tabla de locks separada: sobreingeniería para el caso de uso.

**Justificación**: Es atómico, usa solo Postgres (ya disponible), y `NOWAIT` retorna error inmediato en lugar de esperar por un lock. Esto permite devolver `409` sin bloquear threads.

**Riesgo**: `NOWAIT` puede fallar con `lock_not_available` si la query anterior aún no comitteó. El código debe capturar este error de Postgres específicamente y convertirlo en `409`.

**Archivos**:
- `lib/ejecuciones/actions.ts` — `dispararEjecucion(casoPruebaId)` con el lock transaccional

---

### Decisión 4: Reporter custom de Playwright que emite JSON línea a línea por stdout

**Opción elegida**: Crear `scripts/playwright-reporter.js` — un reporter custom de Playwright que escribe un objeto JSON por línea a stdout. El worker parsea cada línea como evento. El worker hace `spawn('npx', ['playwright', 'test', tmpFile, '--reporter=json'], { stdio: ['pipe', 'pipe', 'pipe'] })` y consume `stdout` línea por línea.

**Formato de eventos**:
```json
{"type":"step","numero":1,"descripcion":"Navegar a /login","estado":"paso","duracionMs":1234}
{"type":"step","numero":2,"descripcion":"Llenar formulario","estado":"fallo","errorMsg":"Timeout 30000ms"}
{"type":"result","estado":"fallo","errorMsg":"2 tests failed"}
```

**Alternativas consideradas**:
- `--reporter=json` built-in de Playwright: solo emite el resultado final al terminar la ejecución, no paso a paso. No sirve para streaming en vivo.
- Playwright API programática (`@playwright/test` importado directamente): posible, pero requiere mantener el proceso vivo y parsear eventos internos del runner. El reporter custom es más simple y decoupling.
- Archivo de reporte JSON escrito a disco: el worker debería leer el archivo al final, no hay streaming. Además requiere cleanup.

**Justificación**: El reporter custom es la forma más directa de obtener eventos de paso en tiempo real desde `npx playwright test`. Escribiendo a stdout (no a archivo), el worker parsea línea a línea sin necesidad de filesystem. Es fácil de debuguear (se puede ver el output en logs).

**Riesgo**: Si el output de Playwright contiene líneas que no son JSON (warnings, errores de Node), el parser debe ignorarlas. Mitigación: `try { JSON.parse(line) } catch { continue }`.

**Archivos**:
- `scripts/playwright-reporter.js` — reporter custom
- `scripts/playwright-worker.ts` — parseo de stdout

---

### Decisión 5: Validación lazy del script — intentar ejecutar, marcar `errorMotor` si falla

**Opción elegida**: No pre-validar el contenido TypeScript del script. Solo verificar que `script.trim() !== ''`. Escribir a archivo temporal e intentar `npx playwright test`. Si Playwright falla con error de parse o archivo no ejecutable, insertar `PasoEjecucion` con estado `errorMotor` y el mensaje de error. La ejecución completa se marca con `estado = 'errorMotor'` y `errorMsg = <detalle>`.

**Alternativas consideradas**:
- Parser TypeScript previo (ts-node o SWC): introduce complejidad innecesaria. El error de parse de Playwright es autoritativo.
- Verificar que el script contiene `test()` o `describe()`: heurística frágil; un script puede tener helpers o fixtures sin `test()` directo.
- Validación en BD antes de crear ejecución: no es posible sin ejecutar; el script puede ser sintácticamente correcto pero no ser un test de Playwright.

**Justificación**: Es la validación más simple y la única que realmente verifica que el script funciona. Si `script` está vacío → `errorMotor` inmediatamente sin intentar ejecutar. Si tiene contenido pero falla Playwright → `errorMotor` con el mensaje real.

**Riesgo**: Si el script tarda mucho en fallar (e.g., un timeout de red), la ejecución queda en estado `corriendo` hasta que Playwright falle. El worker tiene un timeout global de 5 minutos por ejecución que lo fuerza a terminar.

**Archivos**:
- `scripts/playwright-worker.ts` — lógica de validación y ejecución
- `lib/ejecuciones/actions.ts` — `validarYEjecutar(casoPruebaId, script, scriptFileName)`

---

### Decisión 6: `@playwright/test` como devDependency

**Opción elegida**: Agregar `@playwright/test` como `devDependency` en `package.json`. El worker ejecuta `npx playwright test` desde `node_modules/.bin/`. En Docker, el `node_modules` del proyecto se preserva en el volumen o se copia al contenedor.

**Alternativas consideradas**:
- `dependency` (producción): innecesario; Playwright no se necesita para correr la app Next.js, solo para el worker.
- Instalación global en Docker (`npx playwright install`): lento en cada deploy; mejor que esté en `node_modules`.
- Ejecución via global Playwright (`playwright test` sin npx): no confiable en producción; depende de instalación global.

**Justificación**: El worker es un proceso sidecar que solo corre cuando hay ejecuciones pendientes. No necesita ser `dependency` de la app Next.js. `devDependency` es consistente con que es una herramienta de desarrollo/testing.

**Riesgo**: Si el contenedor standalone de Next.js se construye sin `node_modules` (solo el built de Next.js), el worker no tiene acceso a Playwright. Mitigación: asegurar que el `Dockerfile` copie `node_modules` o que el worker se ejecute fuera del contenedor standalone.

**Archivos**:
- `package.json` — agregar `@playwright/test` en `devDependencies`
- `playwright.config.ts` — configuración base para el reporter custom y timeouts
- `Dockerfile` / `docker-compose.yml` — asegurar que Playwright está disponible para el worker

---

## Alcance

### Incluido

- Botón "Ejecutar" en la UI de detalle de caso de prueba
- Endpoint `POST /api/ejecuciones` para disparar una ejecución
- Lock de concurrencia atómico por `casoPruebaId` (AC-5, AC-6)
- Worker standalone que polling-ea ejecuciones `pendiente` cada 5s
- Escritura del script a archivo temporal, ejecución con Playwright
- Reporter custom que emite JSON por stdout
- Parseo de stdout línea a línea → inserción de `PasoEjecucion` por cada paso
- Timeout global de 5 minutos por ejecución
- Validación lazy: script vacío/inválido → `errorMotor`
- Endpoint `GET /api/ejecuciones/[id]` con pasos ordenados por número
- Página de detalle de ejecución `/ejecuciones/[id]` con polling cada 2s
- Highlight visual de paso recién agregado (~2 segundos)
- Página global `/ejecuciones` con tabla agrupada por proyecto
- Estados de ejecución: `pendiente`, `corriendo`, `paso`, `fallo`, `exito`, `errorMotor`
- Los 11 criterios de aceptación

### Excluido (para fases futuras)

- Message queue para streaming real (BullMQ, RabbitMQ) —替换 polling SSE en el futuro
- Credenciales automáticas injectadas al test (HU-7, prioridad baja)
- Re-ejecución de pasos fallidos individualizados
- Playwright en modo headed (solo headless)
- Histórico de ejecuciones con diff de pasos entre ejecuciones
- Notificaciones push (email, Slack) al terminar ejecución

---

## Dependencias

- `@playwright/test` — devDependency (nueva)
- `playwright` — se instala implícitamente con `@playwright/test`
- No requiere cambios en el schema de Prisma
- No requiere Redis ni message queue externo

---

## Impacto

### En el codebase actual

**Nuevos archivos**:
- `scripts/playwright-worker.ts` — worker principal
- `scripts/playwright-reporter.js` — reporter custom de Playwright
- `lib/ejecuciones/actions.ts` — acciones de negocio (disparar, pre-check, actualizar)
- `app/api/ejecuciones/route.ts` — POST para disparar
- `app/api/ejecuciones/[id]/route.ts` — GET detalle, PATCH estado
- `app/(dashboard)/ejecuciones/[id]/page.tsx` — página de detalle
- `app/(dashboard)/ejecuciones/[id]/ejecucion-client.tsx` — cliente de polling
- `app/(dashboard)/ejecuciones/page.tsx` — listado global
- `playwright.config.ts` — configuración base

**Archivos modificados**:
- `package.json` — agregar `@playwright/test` en devDependencies
- `app/(dashboard)/casos/casos-client.tsx` — agregar botón "Ejecutar"
- `docker-compose.yml` / `Dockerfile` — arrancar worker junto con la app
- `next.config.ts` — considerar copiar `scripts/` al standalone output

**Nuevas dependencias npm**:
- `@playwright/test` (dev)
- `playwright` (peer/implicit)

### En la experiencia de usuario

- Usuario ve botón "Ejecutar" en la vista de detalle de un caso
- Al presionar, recibe respuesta inmediata ("Ejecución iniciada")
- Puede ver la página de detalle y observar pasos aparecer en tiempo real
- Si otra ejecución del mismo caso está en curso, ve mensaje de error 409 claro
- Si el script está vacío o inválido, ve estado `errorMotor` con mensaje de error del motor
- La pestaña global `/ejecuciones` muestra todas las ejecuciones agrupadas por proyecto

---

## Checklist de los 11 ACs

| AC | Descripción | Abordado en |
|----|-------------|-------------|
| AC-1 | Caso registrado + presionar "ejecutar" → INSERT Ejecucion(estado=pendiente), respuesta inmediata | `app/api/ejecuciones/route.ts` (POST), `lib/ejecuciones/actions.ts` (`dispararEjecucion`) |
| AC-2 | Ejecución pasa a "corriendo" → la vista se actualiza sin reload manual | `GET /api/ejecuciones/[id]` con polling cada 2s en `ejecucion-client.tsx` |
| AC-3 | Ejecución termina → estado refleja "paso" o "falló" según resultado real de Playwright | Worker actualiza `Ejecucion.estado` según resultado del reporter; `PasoEjecucion.estado` por cada paso |
| AC-4 | Pestaña global `/ejecuciones` → todas las ejecuciones agrupadas por proyecto | `app/(dashboard)/ejecuciones/page.tsx` con query a `lib/ejecuciones/actions.ts` (`listarEjecuciones`) |
| AC-5 | Caso con ejecución en curso → segundo disparo bloqueado con mensaje claro | `lib/ejecuciones/actions.ts` — `FOR UPDATE NOWAIT` + throw 409 |
| AC-6 | Ejecución en curso termina → próximo disparo permitido | El lock solo existe mientras la transacción está activa; al terminar (corriendo→paso/fallo/errorMotor) el siguiente disparo pasa el lock check |
| AC-7 | Script vacío/inválido/no existe → estado = `errorMotor` con mensaje en `errorMsg` | `scripts/playwright-worker.ts` — validación lazy + catch de errores de Playwright |
| AC-8 | Estado `errorMotor` → detalle no muestra pasos falsos (nunca corrió) | Si `errorMotor`, se inserta un único `PasoEjecucion` con estado `errorMotor` y `errorMsg`; no se insertan pasos de test |
| AC-9 | Ejecución corriendo → cada paso aparece en detalle sin reload (polling 2s del cliente) | `GET /api/ejecuciones/[id]` + `setInterval` 2000ms en `ejecucion-client.tsx` |
| AC-10 | Paso recién agregado → se distingue visualmente como "recién agregado" por ~2 segundos | CSS class `.paso-nuevo` con transition; el cliente compara `createdAt` con `Date.now() - 2000ms` |
| AC-11 | Ejecución terminada → orden y contenido de pasos refleja exactamente lo emitido (nada sintetizado) | Reporter custom emite JSON por stdout; worker inserta `PasoEjecucion` con los datos exactos del reporter; sin síntesis ni relleno |

---

## Tradeoffs documentados

1. **Polling SSE vs HTTP**: Se eligió polling HTTP cada 2s porque Prisma no soporta `LISTEN/NOTIFY`. Esto es inferior a SSE/push real, pero es la solución más simple para el stack actual. Tradeoff: latencia máxima de 2s por paso vs complejidad de agregar un message queue.

2. **Reporter custom vs API programática**: Se eligió reporter custom (escribe JSON a stdout) en lugar de usar Playwright API programáticamente. Tradeoff: más fácil de implementar y decoupling del runner, pero más frágil si Playwright cambia su output.

3. **devDependency vs dependency**: `@playwright/test` como devDependency significa que no está disponible en el contenedor standalone de Next.js si este se construye sin `node_modules`. Tradeoff: simplicidad de gestión de paquetes vs posibles problemas de Docker.

4. **Timeout global de 5 minutos**: Si un test tarda más de 5 minutos, el worker lo mata. Tradeoff: protege contra tests colgados vs puede cortar tests legítimos de larga duración. Se puede ajustar via configuración.

5. **Validación lazy vs pre-validación**: Se intentó ejecutar en lugar de pre-validar el script. Tradeoff: la validación es real ( autoritativa de Playwright) vs riesgo de ocupar un worker con un script que va a fallar inevitablemente.
