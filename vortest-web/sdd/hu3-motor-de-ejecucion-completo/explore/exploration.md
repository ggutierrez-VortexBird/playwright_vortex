# HU-3 — Exploración

## Hallazgos

### Hallazgo 1: Playwright NO está instalado como dependencia npm
**Qué**: El `package.json` no incluye `@playwright/test` ni `playwright` en ninguna sección. El proyecto solo tiene Jest para testing.

**Dónde**: `playwright_vortex/package.json` líneas 19-51

**Implicancia**: La HU-3 debe incluir la instalación de Playwright como dependencia del proyecto. O bien como `devDependency` (para el worker) o como `dependency` (si se usa programmatically). Alternativa: se ejecuta vía `npx playwright test` global, pero eso no es confiable en producción. El mockup y los fixtures en `fixtures/test-script.spec.ts` referencian `@playwright/test` pero no existe en el package.json del proyecto — los e2e tests probablemente usan una instalación global o de otro workspace.

---

### Hallazgo 2: Script almacenado como TEXTO en BD, no como ruta de archivo
**Qué**: El modelo `CasoPrueba` en el schema Prisma tiene `script String @db.Text` y `scriptFileName String?`. Esto guarda el contenido completo del `.spec.ts`, no una ruta a archivo en disco. La convención `convencion-scripts-playwright.md` habla de `rutaScript` como path relativo, pero el schema implementa contenido directo.

**Dónde**: `prisma/schema.prisma` líneas 103-122

**Implicancia**: El worker debe:
1. Leer `script` + `scriptFileName` de la BD
2. Escribir a archivo temporal (`os.tmpdir()/playwright-vortex/<runId>-<sanitized>.spec.ts`)
3. Ejecutar `npx playwright test <archivo-temporal> --reporter=json`
4. Capturar stdout/stderr del reporter
5. Borrar archivo temporal al terminar

Esto es un cambio respecto a lo que dice la convención (que habla de `rutaScript` como path en disco). La convención documenta el modelo mental viejousado pero el schema es diferente.

---

### Hallazgo 3: `lib/script-validation.ts` NO existe
**Qué**: La convención `convencion-scripts-playwright.md` sección 7.1 menciona `lib/script-validation.ts` con `resolveScriptPath()` y `validateScriptPath()`, pero este archivo no existe en `lib/`.

**Dónde**: `lib/` solo contiene: `auth.ts`, `db.ts`, `password.ts`, `casos/`, `espacios/`, `proyectos/`, `utils.ts`

**Implicancia**: Para la validación lazy (ejecución) de HU-3.3, hay que crear este módulo. Sin embargo, como el script viene como TEXT de la BD (no como path), la validación de HU-3.3 es sobre el contenido, no sobre una ruta. Opcionalmente se puede hacer un parse básico del TypeScript para verificar que tiene `test()` o `describe()` de Playwright.

---

### Hallazgo 4: No existe infraestructura de worker ni streaming
**Qué**: `lib/ejecuciones/`, `app/api/ejecuciones/`, `scripts/`, y cualquier archivo con `worker` o `stream` no existen. La carpeta `app/(dashboard)/ejecuciones/` solo tiene un placeholder: "Historial de ejecuciones (próximamente)."

**Dónde**: `app/(dashboard)/ejecuciones/page.tsx` — placeholder

**Implicancia**: Toda la arquitectura de ejecución, desde el API de disparo hasta el streaming de pasos, es tierra de nadie. Hay que construir:
- `lib/ejecuciones/actions.ts` — lógica de negocio (crear ejecución, pre-check concurrencia, actualizar estado)
- `app/api/ejecuciones/route.ts` — POST para disparar (AC-1)
- `app/api/ejecuciones/[id]/route.ts` — GET para detalle, PATCH para actualizar estado
- `app/api/ejecuciones/[id]/pasos/stream/route.ts` — SSE para streaming de pasos (AC-9, AC-10)
- Worker: `scripts/playwright-worker.ts` o `lib/ejecuciones/worker.ts` — proceso separado que polling-nea ejecuciones pendientes y las ejecuta

---

### Hallazgo 5: Prisma no soporta PostgreSQL LISTEN/NOTIFY directamente
**Qué**: Prisma Client no tiene API para `LISTEN/NOTIFY` de Postgres. Para streaming en vivo de pasos (AC-9, AC-10), no se puede rely on Postgres notifications nativamente.

**Dónde**: `lib/db.ts` — Prisma singleton estándar

**Implicancia**: Las opciones para streaming de pasos son:
1. **SSE con polling del cliente**: El cliente hace fetch periódico a `GET /api/ejecuciones/[id]/pasos` cada 1-2 segundos. Simple, funciona, pero no es real-time push del server.
2. **SSE con archivo de eventos**: El worker escribe pasos a un archivo, y un route handler de Next.js hace `ReadableStream` desde ese archivo. Problema: coordinación de escritura/lectura.
3. **Polling con efecto colateral de DB**: El worker inserta `PasoEjecucion` en Postgres; el cliente polling-ea `GET /api/ejecuciones/[id]` que devuelve los pasos actualizados. Es lo más simple y coherente con el stack actual.

**Recomendación para AC-9/AC-10**: SSE no es viable con Prisma solo. Usar polling del cliente cada 1-2 segundos contra `GET /api/ejecuciones/[id]` (que incluye `pasos` con order). El highlight visual de "recién agregado" (AC-10) se maneja en el cliente comparando `createdAt` del paso con `Date.now() - 2000ms`.

---

### Hallazgo 6: Arquitectura de lock transaccional sin Redis
**Qué**: Para AC-5 (evitar ejecuciones simultáneas del mismo caso), no hay Redis ni ningún sistema de lock externo. Solo se tiene Postgres.

**Dónde**: `prisma/schema.prisma` — `Ejecucion.casoPruebaId` y `@@index([estado])`

**Implicancia**: El pre-check de concurrencia debe hacerse con una query atómica de Postgres. Patrón:
```sql
-- Verificar si existe una ejecución pendiente o corriendo para este caso
SELECT id FROM "Ejecucion" 
WHERE "casoPruebaId" = $casoId 
AND estado IN ('pendiente', 'corriendo')
FOR UPDATE NOWAIT;
```
Si la query falla con `lock_not_available`, devolver 409 con mensaje de "ejecución en curso". Si no hay lock, Insert `Ejecucion` con `estado = pendiente` en la misma transacción. Esto es atómico y no requiere Redis.

En Prisma esto se puede hacer con `$transaction` + `prisma.$queryRaw` para el `FOR UPDATE NOWAIT`.

---

### Hallazgo 7: Modelo de datos de Ejecución ya existe y es completo
**Qué**: Los modelos `Ejecucion` y `PasoEjecucion` están completos en el schema con todos los campos mencionados en la HU: `id`, `casoPruebaId`, `estado` (enum), `inicioAt`, `finAt`, `duracionMs`, `pasos`, `artefactos`, `acta`.

**Dónde**: `prisma/schema.prisma` líneas 128-177

**Implicancia**: No hay que tocar el schema. Los enums `EjecucionEstado` y `PasoEjecucionEstado` cubren todos los estados necesarios para AC-3, AC-7, AC-8.

---

### Hallazgo 8: Patrones establecidos del codebase son consistentes
**Qué**: El proyecto usa un patrón muy definido:
- Server Actions en `lib/{entidad}/actions.ts` con `requireSuperadmin()`, validación manual, throws `{ status, body }`
- API Routes en `app/api/{entidad}/route.ts` delegando a actions
- Pages Server Component + Client Component (`{entidad}-client.tsx`)
- Auth via iron-session + middleware
- Prisma singleton en `lib/db.ts`

**Dónde**: Todo el codebase

**Implicancia**: La HU-3 debe seguir estos patrones exactamente. El worker, sin embargo, es una pieza nueva que no sigue el patrón de API route → action. El worker es un script Node.js standalone que se comunica con la BD via Prisma y lanza child processes de Playwright.

---

### Hallazgo 9: Output standalone en next.config.ts
**Qué**: `next.config.ts` tiene `output: "standalone"`. El proyecto está configurado para deploy como contenedor standalone de Next.js.

**Dónde**: `next.config.ts`

**Implicancia**: El worker de Playwright puede ejecutarse:
- Como script separado (`node scripts/playwright-worker.ts`) arrancado junto con el contenedor via `CMD` o `docker-compose`
- Dentro del mismo proceso Next.js (no recomendado — Playwright es pesado y bloqueante)
- Como microservicio separado (sobrekill para MVP)

**Recomendación**: Script separado que polling-ea la BD cada 5-10 segundos. Se arranca con `docker-compose` junto con Next.js.

---

### Hallazgo 10: Convencion usa modelo de ruta; schema usa contenido
**Qué**: Inconsistencia detectada entre la convención `convencion-scripts-playwright.md` (que dice que `casoPrueba.rutaScript` almacena una ruta relativa POSIX) y el schema real de Prisma (que tiene `script TEXT` con el contenido y `scriptFileName`). La convención sección 8 dice "error común: script no encontrado" y sección 7.2 muestra `npx playwright test <abs>` con resolución de ruta.

**Dónde**: `documentacion/convencion-scripts-playwright.md` vs `prisma/schema.prisma` líneas 108-109

**Implicancia**: La convención fue escrita con un modelo mental de "archivo en disco referenciado por path". Pero la HU-2.3 guardó el script como TEXT. Esto significa que el worker no hace `fs.access` de una ruta — directamente recibe el contenido. La validación lazy de la convención (sección 6.1) no aplica literalmente; en su lugar hay que validar que el TEXT es parseable como Playwright test antes de escribirlo al temp file.

---

### Hallazgo 11: No hay componente de UI para ejecutar un caso
**Qué**: La página de casos (`app/(dashboard)/casos/casos-client.tsx`) tiene botones de editar/eliminar pero ningún botón de "Ejecutar". No hay modal ni UI de detalle de ejecución con pasos en vivo.

**Dónde**: `app/(dashboard)/casos/` y `app/(dashboard)/ejecuciones/`

**Implicancia**: La HU-3 requiere:
- Un botón "Ejecutar" en cada fila de caso (o en la vista de detalle del caso)
- Una página de detalle de ejecución (`/ejecuciones/[id]`) que muestre pasos en vivo
- Un indicator visual de "recién agregado" (~2 segundos) para pasos nuevos
- La página global `/ejecuciones` con tabla agrupada por proyecto

---

## Preguntas abiertas

1. **¿Playwright como devDependency o dependency?** Si el worker es un script separado (`scripts/playwright-worker.ts`), puede ser `devDependency`. Si el worker corre en el mismo container que Next.js, podría necesitarse como `dependency` para poder hacer `require('@playwright/test')`.

2. **¿Cómo arrancar el worker?** ¿Junto con `npm run dev`? ¿Separado con `docker-compose`? ¿Dentro de Next.js via route handler que polling-ea? La decisión afecta la arquitectura.

3. **¿Reporter de Playwright?** Para capturar pasos, la HU necesita un reporter custom que emita JSON por stdout. ¿Se usa el reporter JSON built-in (`--reporter=json`) o un reporter custom escrito a medida? El reporter JSON built-in de Playwright no emite paso a paso durante la ejecución — solo al final.

4. **¿Validación del script en BD?** Antes de escribir el script a archivo temporal y ejecutar, ¿se valida que el TEXT es un Playwright test válido? O se intenta ejecutar y si falla con error de Parse, se marca `errorMotor`?

5. **¿Timeout de ejecución?** ¿Hay un timeout máximo para una ejecución? ¿Qué pasa si Playwright se cuelga?

6. **¿Credenciales?** La HU-7 (credenciales) es de "prioridad baja" según el schema. El worker ¿tiene acceso a credenciales del proyecto para injectarlas al test?

---

## Decisiones de diseño recomendadas

### D1: Arquitectura del worker
**Decisión**: Worker como script Node.js standalone (`scripts/playwright-worker.ts`), separado del proceso Next.js, que polling-ea la BD cada 5 segundos buscando ejecuciones en estado `pendiente`.

**Justificación**:
- Next.js standalone output significa que el contenedor solo tiene el built de Next.js, no scripts adicionales
- Alternativa: un route handler en Next.js que se auto-invoca (no recomendado — se mezcla preocupaciones)
- Alternativa: un servicio externo (sobrekill para MVP)

**Flujo**:
```
Worker polling each 5s:
  1. SELECT * FROM "Ejecucion" WHERE estado = 'pendiente' LIMIT 1 FOR UPDATE SKIP LOCKED
  2. Si encuentra: UPDATE estado='corriendo', inicioAt=NOW()
  3. Leer CasoPrueba.script + scriptFileName
  4. Escribir a temp file
  5. Spawn: npx playwright test <tmpFile> --reporter=json
  6. Parsear output línea por línea → INSERT PasoEjecucion
  7. UPDATE Ejecucion estado=resultado, finAt, duracionMs
  8. Eliminar temp file
```

### D2: Streaming de pasos (AC-9, AC-10)
**Decisión**: Polling del cliente cada 2 segundos contra `GET /api/ejecuciones/[id]` que retorna con `pasos` ordenados por número. El highlight visual de "recién agregado" se maneja en cliente comparando `createdAt` del paso con `Date.now() - 2000ms`.

**Justificación**:
- Prisma no soporta LISTEN/NOTIFY
- SSE requeriría un mecanismo externo de coordinación
- El polling de 2 segundos es aceptable para UI interactiva
- El highlight de 2 segundos se implementa en CSS/JS con un transition

**Alternativa postergable**: Reemplazar polling por SSE cuando se implemente un message queue (RabbitMQ, BullMQ) — queda como mejora futura.

### D3: Lock de concurrencia (AC-5, AC-6)
**Decisión**: Usar `SELECT ... FOR UPDATE NOWAIT` dentro de una transacción Prisma para el pre-check atómico.

**Código**:
```typescript
const existingRunning = await prisma.$transaction(async (tx) => {
  const running = await tx.$queryRaw<Ejecucion[]>(
    `SELECT id FROM "Ejecucion" 
     WHERE "casoPruebaId" = ${casoPruebaId} 
     AND estado IN ('pendiente', 'corriendo')
     FOR UPDATE NOWAIT`
  );
  if (running.length > 0) throw { status: 409, body: { error: 'conflict', message: 'Ya existe una ejecución en curso para este caso' } };
  return tx.ejecucion.create({ data: { casoPruebaId, estado: 'pendiente' } });
});
```

### D4: Reporter de Playwright para pasos
**Decisión**: Usar un reporter custom de Playwright que escribe líneas JSON a stdout (una por paso). El worker parsea stdout línea por línea.

**Formato de evento por paso**:
```json
{"type":"step","numero":1,"descripcion":"Navegar a /login","estado":"paso","duracionMs":1234}
{"type":"step","numero":2,"descripcion":"Llenar formulario","estado":"fallo","errorMsg":"Timeout 30000ms"}
{"type":"result","estado":"fallo","duracionMs":5000}
```

**Alternativa**: Usar `--reporter=json` built-in y parsear el JSON al final. Pero esto no da streaming en vivo — solo resultado final. Para steps en vivo, se necesita un reporter custom.

### D5: Validación del script (HU-3.3 / AC-7)
**Decisión**: Intentar ejecutar primero; si falla con error de parse o archivo vacío, marcar `errorMotor`.

**No pre-validar** el contenido TypeScript del script (es complejo sin un parser TS). Si `script.trim() === ''` → `errorMotor` inmediatamente. Si no, escribir a archivo temporal e intentar `npx playwright test`. Si el test no puede parsarse o el archivo no existe → `errorMotor`.

### D6: Instalación de Playwright
**Decisión**: Agregar `@playwright/test` como `devDependency`. El worker se ejecuta en dev con `npx playwright test` del `node_modules` local. En producción (Docker), el `node_modules` del proyecto ya incluye Playwright si se instaló como devDependency.

**Verificar**: Si el contenedor standalone de Next.js pierde las devDependencies, puede ser necesario moverlo a `dependencies` o instalar Playwright en el Dockerfile.

---

## Próximo paso

Pasar a la fase **PROPOSE** con:
1. La arquitectura del worker definida (D1)
2. El mecanismo de streaming (D2) 
3. El lock transaccional (D3)
4. El reporter custom (D4)
5. La decisión de validación (D5)
6. La decisión de instalación de Playwright (D6)

Esto permite escribir el SPEC.md con todas las decisiones de diseño tomadas y proceder a TASK planning.