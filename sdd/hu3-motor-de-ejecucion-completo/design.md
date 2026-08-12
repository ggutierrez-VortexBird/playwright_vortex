# HU-3 — Diseño técnico: Motor de ejecución Playwright

> **Modelo**: kimi-k2.6 | **Fase**: Design | **Pipeline**: Vorkan v2.1.0
> **Proyecto**: `playwright_vortex` | **Stack**: Next.js 15 (App Router) + Prisma + Postgres + iron-session

---

## Resumen de la arquitectura

El motor de ejecución es un sistema de **4 componentes** que se comunican a través de la base de datos Postgres como única fuente de verdad compartida:

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐     ┌───────────────────┐
│  UI (Next)  │────▶│  Server Action    │────▶│   Postgres   │◀────│  Worker (Node.js) │
│  Browser    │◀────│  / API Route      │     │  (Prisma)    │────▶│  playwright-worker│
└─────────────┘     └──────────────────┘     └──────────────┘     └───────────────────┘
       │                    │                        ▲                       │
       │                    │                        │                       │
       │  polling 2s        │  crear ejecucion       │                       │
       │◀───────────────────┘  (POST /api/ejecucion) │  SELECT pendiente     │
       │                                           │  INSERT pasos          │
       │                                           │  UPDATE estado final   │
       └───────────────────────────────────────────┘
                     GET /api/ejecuciones/[id]
```

**Flujo completo**:

1. Usuario presiona "Ejecutar" en la UI → `POST /api/ejecuciones` via Server Action
2. Server Action ejecuta `SELECT FOR UPDATE NOWAIT` en transacción Prisma; si pasa → `INSERT Ejecucion(estado=pendiente)`
3. Worker polling cada 5s: `SELECT ... FOR UPDATE SKIP LOCKED WHERE estado='pendiente'`
4. Worker marca `corriendo`, lee `CasoPrueba.script`, escribe archivo temporal
5. Worker ejecuta `npx playwright test <tmp> --reporter=custom`; el reporter custom emite JSON por stdout
6. Worker parsea stdout línea a línea → `INSERT PasoEjecucion` por cada paso
7. Al terminar: `UPDATE Ejecucion SET estado=resultado, finAt, duracionMs`
8. Cliente polling `GET /api/ejecuciones/[id]` cada 2s → UI se actualiza sin reload

---

## Diagrama de flujo detallado

### Fase 1: Disparo (AC-1, AC-5, AC-6)

```
1. Usuario presiona "Ejecutar" en /proyectos/[id]/casos o /casos
2. Server Action: getSession() → requireSuperadmin()
3. Server Action: dispararEjecucion(casoPruebaId)
   a. prisma.$transaction(async tx => {
        // FOR UPDATE NOWAIT: atómico, no espera
        const running = await tx.$queryRaw<Ejecucion[]>`
          SELECT id FROM "Ejecucion"
          WHERE "casoPruebaId" = ${casoPruebaId}
          AND estado IN ('pendiente', 'corriendo')
          FOR UPDATE NOWAIT
        `
        if (running.length > 0)
          throw { status: 409, body: { error: 'conflict', message: '...'} }
        return tx.ejecucion.create({ data: { casoPruebaId, estado: 'pendiente' }})
      })
   b. Devuelve { id, estado: 'pendiente' }
4. UI recibe respuesta inmediata → redirige a /ejecuciones/[id]
```

### Fase 2: Procesamiento del worker (AC-2, AC-3, AC-7, AC-8)

```
5. Worker (cada 5s):
   a. prisma.$queryRaw`SELECT * FROM "Ejecucion" WHERE estado='pendiente' ORDER BY "createdAt" ASC LIMIT 1 FOR UPDATE SKIP LOCKED`
   b. Si hay job:
      - UPDATE estado='corriendo', inicioAt=NOW()
      - Leer CasoPrueba.script + scriptFileName
      - Si script.trim() === '':
          INSERT PasoEjecucion con estado='errorMotor', errorMsg='Script vacío'
          UPDATE Ejecucion estado='errorMotor', finAt=NOW()
          goto cleanup
      - Escribir a os.tmpdir()/playwright-vortex/{runId}-{sanitized}.spec.ts
      - Spawn: npx playwright test {archivo} --reporter=path/to/my-reporter.js
      - stdout.on('data'): try JSON.parse(linea) → INSERT PasoEjecucion
      - on('close'): UPDATE Ejecucion SET estado={paso|fallo|reparado}, finAt=NOW(), duracionMs
6. cleanup: fs.unlink archivo temporal (siempre, incluso en error)
```

### Fase 3: Streaming de pasos al cliente (AC-9, AC-10, AC-11)

```
7. Cliente (/ejecuciones/[id]):
   a. useEffect con setInterval(2000ms)
   b. fetch /api/ejecuciones/{id}
   c. Comparar ids de pasos nuevos vs anteriores
   d. Pasos nuevos → añadir a freshStepIds (Set)
   e. setTimeout(2000ms) para remover highlight
   f. Renderizar pasos con .step.new si está en freshStepIds
```

---

## Decisión 1: Worker como script Node.js standalone

**Problema**: ¿Dónde ejecutar Playwright? Es un proceso pesado, bloqueante, y no debe correr dentro del proceso Next.js.

**Opción elegida**: `scripts/playwright-worker.ts` — script Node.js standalone que se ejecuta junto con la aplicación via `docker-compose` o `npm run worker`.

**Alternativas consideradas**:
- Route handler de Next.js con auto-invocación: mezcla responsabilidades, no escala, compite por recursos con requests HTTP.
- Microservicio separado: introduce latencia de red entre servicios, complejidad de deploy, y overkill para MVP.
- Worker dentro del contenedor standalone de Next.js: `output: "standalone"` solo copia el build de Next.js, no scripts personalizados. Se requeriría un `ENTRYPOINT` personalizado que copie scripts adicionales.

**Justificación**: El polling de 5 segundos es aceptable para un sistema de ejecución de tests (no se requiere latencia sub-segundo en el worker). El proyecto ya usa `output: "standalone"` en `next.config.ts`; el worker corre como sidecar junto al contenedor Next.js. Es la forma más simple y robusta.

**Riesgos y mitigaciones**:
- Si el worker se detiene, ejecuciones pendientes quedan huérfanas en `pendiente`. Mitigación: Docker `restart: unless-stopped` o PM2.
- El worker debe tener su propio `DATABASE_URL` pointing a Postgres.
- En desarrollo: `npm run worker` (script a agregar en `package.json`).

---

## Decisión 2: Streaming de pasos via polling HTTP cada 2 segundos

**Problema**: ¿Cómo comunicar los pasos del worker al cliente en tiempo real? Prisma no soporta `LISTEN/NOTIFY` de Postgres.

**Opción elegida**: El cliente hace `GET /api/ejecuciones/[id]` cada 2 segundos. El endpoint retorna la ejecución con sus `pasos` ordenados por número. El highlight de "recién agregado" se implementa comparando `createdAt` del paso con `Date.now() - 2000ms`.

**Alternativas consideradas**:
- SSE (Server-Sent Events): Prisma no tiene API para `LISTEN/NOTIFY`. SSE requeriría un message queue externo (BullMQ, RabbitMQ) para coordinar la escritura del worker con la lectura del cliente SSE. Sobreingeniería para MVP.
- WebSockets: Misma problemática de coordinación sin broker de mensajes.
- Polling con archivo de eventos en disco: el worker escribe a un archivo, el route handler sirve `ReadableStream`. Problemas de concurrencia de lectura/escritura, cleanup, y complejidad innecesaria.

**Justificación**: Es la implementación más simple y coherente con el stack actual. Un intervalo de 2 segundos es imperceptible para el usuario. El highlight de 2 segundos se maneja con CSS `animation: write .34s ease-out` + JavaScript `setTimeout`.

**Riesgos y mitigaciones**:
- Polling excesivo con muchas ejecuciones concurrentes: 2 segundos es conservador; se puede subir a 5s si el volumen lo requiere.
- El endpoint `/api/ejecuciones/[id]` usa Prisma que ya tiene pooling de conexiones; no hay problema de saturación con polling de 2s para pocos usuarios.

---

## Decisión 3: Lock de concurrencia con `SELECT FOR UPDATE NOWAIT`

**Problema**: ¿Cómo impedir que el mismo caso de prueba tenga 2 ejecuciones simultáneas sin agregar Redis?

**Opción elegida**: Verificación atómica dentro de una transacción Prisma usando `FOR UPDATE NOWAIT`.

```typescript
const result = await prisma.$transaction(async (tx) => {
  const running = await tx.$queryRaw<Ejecucion[]>`
    SELECT id FROM "Ejecucion"
    WHERE "casoPruebaId" = ${casoPruebaId}
    AND estado IN ('pendiente', 'corriendo')
    FOR UPDATE NOWAIT
  `
  if (running.length > 0) {
    throw { status: 409, body: { error: 'conflict', message: '...' } }
  }
  return tx.ejecucion.create({ data: { casoPruebaId, estado: 'pendiente' } })
})
```

**Alternativas consideradas**:
- Redis SETNX: no hay Redis en el stack; agregarlo introduce una dependencia nueva y complica el infrastructure.
- Timestamps en la aplicación: no es atómico; race conditions posibles entre leer y escribir.
- Tabla de locks separada: sobreingeniería para el caso de uso.

**Justificación**: `NOWAIT` retorna error inmediato si la fila está bloqueada, en lugar de esperar. Esto permite devolver `409` sin bloquear threads en Postgres. Es atómico y usa solo Postgres (ya disponible).

**Riesgos y mitigaciones**:
- `NOWAIT` puede fallar con `lock_not_available` si otra transacción aún no comitteó. El código debe capturar este error de Postgres específicamente y convertirlo en `409 Conflict`.
- El lock se libera automáticamente al terminar la transacción (COMMIT o ROLLBACK).

---

## Decisión 4: Reporter custom de Playwright que emite JSON por stdout

**Problema**: ¿Cómo capturar cada paso individual de Playwright en tiempo real? El reporter JSON built-in solo emite resultado final.

**Opción elegida**: Crear `scripts/my-reporter.js` — reporter custom de Playwright que escribe un objeto JSON por línea a stdout. El worker parsea `stdout` línea a línea.

**Formato de eventos del reporter**:
```json
{"type":"step","numero":1,"descripcion":"Navegar a /login","estado":"paso","duracionMs":1234}
{"type":"step","numero":2,"descripcion":"Llenar formulario","estado":"fallo","errorMsg":"Timeout 30000ms"}
{"type":"end","estado":"fallo","duracionMs":5000}
```

**Alternativas consideradas**:
- `--reporter=json` built-in: solo emite el resultado final al terminar la ejecución, no paso a paso. No sirve para streaming en vivo.
- Playwright API programática (`@playwright/test` importado directamente): requiere mantener el proceso vivo y parsear eventos internos del runner. Más complejo y acoplado.
- Archivo de reporte JSON escrito a disco: el worker debería leer el archivo al final, no hay streaming. Además requiere cleanup.

**Justificación**: El reporter custom es la forma más directa de obtener eventos de paso en tiempo real. Escribiendo a stdout (no a archivo), el worker parsea línea a línea sin necesidad de filesystem. Es fácil de debuguear (se puede ver el output en logs del worker).

**Riesgos y mitigaciones**:
- Si el output de Playwright contiene líneas que no son JSON (warnings, errores de Node, stack traces), el parser debe ignorarlas. Mitigación: `try { JSON.parse(line) } catch { continue }`.

---

## Decisión 5: Validación lazy — intentar ejecutar, marcar `errorMotor` si falla

**Problema**: ¿Cómo validar el script antes de ejecutarlo? ¿Parser TypeScript previo? ¿Verificar que tiene `test()` o `describe()`?

**Opción elegida**: No pre-validar el contenido TypeScript. Solo verificar que `script.trim() !== ''`. Escribir a archivo temporal e intentar `npx playwright test`. Si Playwright falla con error de parse o archivo no ejecutable, marcar `errorMotor`.

**Alternativas consideradas**:
- Parser TypeScript previo (ts-node o SWC): introduce complejidad innecesaria. El error de parse de Playwright es autoritativo.
- Verificar que el script contiene `test()` o `describe()`: heurística frágil; un script puede tener helpers o fixtures sin `test()` directo.
- Validación en BD antes de crear ejecución: no es posible sin ejecutar; el script puede ser sintácticamente correcto pero no ser un test de Playwright válido.

**Justificación**: Es la validación más simple y la única que realmente verifica que el script funciona. Si `script` está vacío → `errorMotor` inmediatamente sin intentar ejecutar. Si tiene contenido pero falla Playwright → `errorMotor` con el mensaje real del motor.

**Riesgos y mitigaciones**:
- Si el script tarda mucho en fallar (e.g., un timeout de red), la ejecución queda en estado `corriendo` hasta que Playwright falle. El worker tiene un timeout global de 5 minutos por ejecución (`timeout: 300000` en `playwright.config.ts`) que fuerza el terminate.
- Si el script tiene contenido pero no es un Playwright test válido, Playwright mismo lo rechaza → `errorMotor`.

---

## Decisión 6: `@playwright/test` como devDependency

**Problema**: ¿Cómo instalar Playwright? ¿devDependency o dependency? ¿Global o local?

**Opción elegida**: Agregar `@playwright/test` como `devDependency` en `package.json`. El worker ejecuta `npx playwright test` desde `node_modules/.bin/`. En Docker, el `node_modules` del proyecto se preserva o se copia al contenedor.

**Alternativas consideradas**:
- `dependency` (producción): innecesario; Playwright no se necesita para correr la app Next.js, solo para el worker.
- Instalación global en Docker (`npx playwright install`): lento en cada deploy; mejor que esté en `node_modules`.
- Ejecución via global Playwright (`playwright test` sin npx): no confiable en producción; depende de instalación global.

**Justificación**: El worker es un proceso sidecar que solo corre cuando hay ejecuciones pendientes. No necesita ser `dependency` de la app Next.js. `devDependency` es consistente con que es una herramienta de desarrollo/testing.

**Riesgos y mitigaciones**:
- Si el contenedor standalone de Next.js se construye sin `node_modules` (solo el built de Next.js), el worker no tiene acceso a Playwright. Mitigación: asegurar que el `Dockerfile` o `docker-compose.yml` copie `node_modules` al contenedor del worker, o ejecutar el worker fuera del contenedor standalone.
- Para desarrollo local: `npm install` instala todas las dependencias incluyendo dev.
- Para producción: se recomienda que el worker corra en el mismo host que el contenedor de BD, con acceso a `node_modules` del proyecto.

---

## Estructura de archivos

```
playwright_vortex/
├── scripts/
│   ├── worker.ts                    # Worker standalone (node --import tsx scripts/worker.ts)
│   └── my-reporter.js              # Reporter custom de Playwright (JSON por stdout)
├── lib/
│   ├── worker/
│   │   ├── reporter.ts             # Wrapper TS del reporter custom (para importación)
│   │   ├── runner.ts               # Lógica de spawn + parseo stdout + INSERT pasos
│   │   ├── lock.ts                 # Check anti-concurrencia con FOR UPDATE NOWAIT
│   │   ├── script-temp.ts          # Helper: BD → tmp file → cleanup
│   │   └── validate-script.ts      # Validación lazy del script
│   └── ejecuciones/
│       ├── actions.ts              # Server Actions (dispararEjecucion, getEjecucion)
│       └── queries.ts              # Prisma queries (listEjecuciones, getEjecucionConPasos)
├── app/
│   ├── (dashboard)/
│   │   ├── ejecuciones/
│   │   │   ├── page.tsx            # Listado global agrupado por proyecto (Server Component)
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Detalle de ejecución (Server Component)
│   │   │       └── ejecucion-client.tsx  # 'use client', polling 2s, highlight steps
│   ├── api/
│   │   └── ejecuciones/
│   │       ├── route.ts            # POST: crear ejecución (delegar a Server Action)
│   │       └── [id]/
│   │           └── route.ts        # GET: obtener ejecución con pasos (para polling)
├── components/
│   └── ejecuciones/
│       ├── ejecutar-button.tsx     # 'use client', botón con loading state y 409 handling
│       ├── ejecucion-status.tsx    # Pill con color según estado (pendiente/corriendo/paso/fallo/reparado/errorMotor)
│       ├── pasos-list.tsx          # 'use client', lista de pasos con highlight
│       ├── ejecucion-summary.tsx   # Resumen de ejecución (estado, duración, timestamps)
│       └── error-motor-badge.tsx   # Badge para estado errorMotor (sello rojo inclinado)
├── playwright.config.ts            # Config base: timeout 5min, headless, reporter custom path
└── package.json                     # + @playwright/test como devDependency
```

**Archivos modificados**:
- `package.json` — agregar `@playwright/test` en `devDependencies`, agregar script `worker`
- `app/(dashboard)/casos/casos-client.tsx` — agregar botón "Ejecutar" en cada fila de caso
- `docker-compose.yml` — asegurar que el worker se arranca junto con la app (volumen compartido con `node_modules`)

**No se toca el schema Prisma**: los modelos `Ejecucion` y `PasoEjecucion` ya tienen todos los campos necesarios.

---

## API / Server Actions

### `POST /api/ejecuciones` (Route Handler → Server Action)

Delega a `dispararEjecucion` en `lib/ejecuciones/actions.ts`.

**Request body**:
```typescript
{ casoPruebaId: string }
```

**Respuestas**:
- `201 Created`: `{ id: string, estado: 'pendiente' }`
- `400 Bad Request`: `{ error: 'validation', message: '...' }` — script vacío en BD
- `403 Forbidden`: `{ error: 'forbidden', message: '...' }` — no es superadmin
- `404 Not Found`: `{ error: 'not_found' }` — caso no existe
- `409 Conflict`: `{ error: 'conflict', message: 'Ya existe una ejecución en curso para este caso' }`

### `GET /api/ejecuciones/[id]` (Route Handler)

```typescript
// lib/ejecuciones/queries.ts
export async function getEjecucionConPasos(id: string) {
  return prisma.ejecucion.findUnique({
    where: { id },
    include: {
      casoPrueba: { select: { id: true, nombre: true, codigo: true, proyectoId: true } },
      pasos: { orderBy: { numero: 'asc' } },
    },
  })
}
```

**Respuesta**:
```json
{
  "id": "uuid",
  "estado": "corriendo",
  "inicioAt": "2026-08-12T10:00:00Z",
  "finAt": null,
  "duracionMs": null,
  "errorMsg": null,
  "casoPrueba": { "id": "...", "nombre": "...", "codigo": "...", "proyectoId": "..." },
  "pasos": [
    { "id": "uuid", "numero": 1, "descripcion": "Navegar a /login", "estado": "paso", "duracionMs": 1234, "selfHealed": false, "errorMsg": null, "createdAt": "..." }
  ]
}
```

### `GET /api/ejecuciones` (Route Handler)

Lista todas las ejecuciones con opción de filtrar por `proyectoId`.

```typescript
// lib/ejecuciones/queries.ts
export async function listEjecuciones(proyectoId?: string): Promise<EjecucionConCaso[]> {
  const where: any = {}
  if (proyectoId) where.casoPrueba = { proyectoId }
  
  return prisma.ejecucion.findMany({
    where,
    include: {
      casoPrueba: { select: { id: true, nombre: true, codigo: true, proyectoId: true, proyecto: { select: { nombre: true } } } },
      pasos: { select: { id: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })
}
```

---

## Worker: scripts/worker.ts

```typescript
// scripts/worker.ts
import { prisma } from '../lib/db'
import { writeTempScript, cleanupTempScript } from '../lib/worker/script-temp'
import { runPlaywrightTest } from '../lib/worker/runner'
import { validateScript } from '../lib/worker/validate-script'
import { Prisma } from '@prisma/client'

const POLL_INTERVAL_MS = 5000

async function main() {
  console.error('[worker] Starting playwright-vortex worker')

  while (true) {
    try {
      // FOR UPDATE SKIP LOCKED: no espera si otra instancia ya hizo lock
      const job = await prisma.$queryRaw<Ejecucion & { script: string; scriptFileName: string | null }[]>`
        SELECT e.*, cp.script, cp."scriptFileName"
        FROM "Ejecucion" e
        JOIN "CasoPrueba" cp ON cp.id = e."casoPruebaId"
        WHERE e.estado = 'pendiente'
        ORDER BY e."createdAt" ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `

      if (job.length === 0) {
        await sleep(POLL_INTERVAL_MS)
        continue
      }

      const { id: ejecucionId, script, scriptFileName } = job[0]

      // Marcar como corriendo
      await prisma.ejecucion.update({
        where: { id: ejecucionId },
        data: { estado: 'corriendo', inicioAt: new Date() },
      })

      // Validación lazy: script vacío → errorMotor inmediato
      const validation = validateScript(script, scriptFileName)
      if (!validation.valid) {
        await prisma.ejecucion.update({
          where: { id: ejecucionId },
          data: { estado: 'errorMotor', finAt: new Date(), errorMsg: validation.error },
        })
        await prisma.pasoEjecucion.create({
          data: {
            ejecucionId,
            numero: 1,
            descripcion: 'Error del motor',
            estado: 'fallo',
            errorMsg: validation.error,
          },
        })
        await sleep(POLL_INTERVAL_MS)
        continue
      }

      // Escribir a archivo temporal
      const tmpPath = await writeTempScript(ejecucionId, script, scriptFileName)

      try {
        // Ejecutar Playwright
        const result = await runPlaywrightTest(tmpPath, ejecucionId)

        // Actualizar estado final
        await prisma.ejecucion.update({
          where: { id: ejecucionId },
          data: {
            estado: result.passed ? 'paso' : 'fallo',
            finAt: new Date(),
            duracionMs: result.durationMs,
          },
        })
      } catch (error: any) {
        // Error del motor (Playwright crashed, timeout, etc.)
        await prisma.ejecucion.update({
          where: { id: ejecucionId },
          data: { estado: 'errorMotor', finAt: new Date(), errorMsg: error.message },
        })
      } finally {
        // Siempre limpiar archivo temporal
        await cleanupTempScript(tmpPath)
      }

      await sleep(POLL_INTERVAL_MS)
    } catch (error) {
      console.error('[worker] Error en polling:', error)
      await sleep(POLL_INTERVAL_MS)
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

main().catch(console.error)
```

---

## Reporter custom: scripts/my-reporter.js

Playwright permite un reporter custom via `--reporter`. Emite JSON por stdout:

```javascript
// scripts/my-reporter.js
// Reporter custom para Playwright — emite un objeto JSON por línea a stdout

let stepCounter = 0

/** @type {import('@playwright/test/reporter').Reporter} */
module.exports = {
  onStepEnd: (test, result) => {
    stepCounter++
    const event = {
      type: 'step',
      numero: stepCounter,
      descripcion: test.title,
      estado: result.status === 'passed' ? 'paso' : result.status === 'failed' ? 'fallo' : 'reparado',
      duracionMs: result.duration,
      selfHealed: result.status === 'flaky' ? true : false,
    }
    process.stdout.write(JSON.stringify(event) + '\n')
  },

  onEnd: (result) => {
    const event = {
      type: 'end',
      estado: result.status === 'passed' ? 'paso' : result.status === 'failed' ? 'fallo' : 'error',
      duracionMs: result.duration,
    }
    process.stdout.write(JSON.stringify(event) + '\n')
  },

  onStdOut: (chunk) => {
    // Ignorar — solo nos interesa stdout del reporter
  },

  onStdErr: (chunk) => {
    // Ignorar — los errores van a stderr del proceso padre
  },
}
```

---

## Runner: lib/worker/runner.ts

```typescript
// lib/worker/runner.ts
import { spawn } from 'child_process'
import * as fs from 'fs/promises'
import { prisma } from '../db'
import * as path from 'path'

export interface PlaywrightResult {
  passed: boolean
  durationMs: number
}

export async function runPlaywrightTest(
  tmpPath: string,
  ejecucionId: string
): Promise<PlaywrightResult> {
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const reporterPath = path.resolve(process.cwd(), 'scripts/my-reporter.js')

    const proc = spawn('npx', [
      'playwright',
      'test',
      tmpPath,
      '--reporter=',
      reporterPath,
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    let stdoutBuffer = ''

    proc.stdout?.on('data', async (chunk: Buffer) => {
      const lines = (stdoutBuffer + chunk.toString()).split('\n')
      stdoutBuffer = lines.pop() ?? '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.type === 'step') {
            await prisma.pasoEjecucion.create({
              data: {
                ejecucionId,
                numero: event.numero,
                descripcion: event.descripcion,
                estado: event.estado,
                duracionMs: event.duracionMs,
                selfHealed: event.selfHealed ?? false,
                errorMsg: event.errorMsg ?? null,
              },
            })
          }
        } catch {
          // Not JSON — ignore (Playwright may print other things to stdout)
        }
      }
    })

    proc.stderr?.on('data', (chunk: Buffer) => {
      // Log stderr for debugging but don't fail on it
      console.error('[playwright stderr]', chunk.toString())
    })

    proc.on('close', (code) => {
      const durationMs = Date.now() - startTime
      if (code === 0) {
        resolve({ passed: true, durationMs })
      } else if (code === 1) {
        // Tests failed but Playwright ran fine
        resolve({ passed: false, durationMs })
      } else {
        reject(new Error(`Playwright exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })

    // Timeout global de 5 minutos
    setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error('Playwright test timed out after 5 minutes'))
    }, 5 * 60 * 1000)
  })
}
```

---

## Polling de pasos en cliente

```typescript
// app/(dashboard)/ejecuciones/[id]/ejecucion-client.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import type { EjecucionConPasos } from '@/types/ejecucion'

interface EjecucionClientProps {
  initialData: EjecucionConPasos
  ejecucionId: string
}

export function EjecucionClient({ initialData, ejecucionId }: EjecucionClientProps) {
  const [ejecucion, setEjecucion] = useState<EjecucionConPasos>(initialData)
  const [freshStepIds, setFreshStepIds] = useState<Set<string>>(new Set())
  const [isPolling, setIsPolling] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // Solo polling si está en estado pendiente o corriendo
    if (ejecucion.estado !== 'pendiente' && ejecucion.estado !== 'corriendo') {
      setIsPolling(false)
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }

    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ejecuciones/${ejecucionId}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data: EjecucionConPasos = await res.json()

        // Detectar pasos nuevos
        const existingIds = new Set(ejecucion.pasos.map(p => p.id))
        const newSteps = data.pasos.filter(p => !existingIds.has(p.id))

        if (newSteps.length > 0) {
          // Marcar pasos nuevos para highlight
          setFreshStepIds(prev => {
            const next = new Set(prev)
            newSteps.forEach(p => next.add(p.id))
            return next
          })

          // Remover highlight después de 2s
          setTimeout(() => {
            setFreshStepIds(prev => {
              const next = new Set(prev)
              newSteps.forEach(p => next.delete(p.id))
              return next
            })
          }, 2000)
        }

        setEjecucion(data)

        // Si terminó, dejar de hacer polling
        if (data.estado !== 'pendiente' && data.estado !== 'corriendo') {
          setIsPolling(false)
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch (err) {
        console.error('[polling] Error:', err)
      }
    }, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [ejecucionId, ejecucion.estado])

  return (
    <div className="flex flex-col gap-6">
      <EjecucionSummary ejecucion={ejecucion} />
      <PasosList pasos={ejecucion.pasos} freshStepIds={freshStepIds} />
    </div>
  )
}
```

```typescript
// components/ejecuciones/pasos-list.tsx
'use client'

import type { PasoEjecucion } from '@prisma/client'

interface PasosListProps {
  pasos: PasoEjecucion[]
  freshStepIds: Set<string>
}

export function PasosList({ pasos, freshStepIds }: PasosListProps) {
  if (pasos.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-surface p-6 text-center">
        <p className="text-ink-3">Aún no hay pasos registrados.</p>
      </div>
    )
  }

  return (
    <div className="ledger">
      {pasos.map((paso) => {
        const isFresh = freshStepIds.has(paso.id)
        return (
          <div
            key={paso.id}
            className={`rstep${isFresh ? ' new' : ''}`}
          >
            <span className="rstep-num">{paso.numero}</span>
            <span className="rstep-desc">{paso.descripcion}</span>
            <span className="rstep-dur">
              {paso.duracionMs != null ? `${paso.duracionMs}ms` : '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
```

---

## Routing

| Ruta | Tipo | Descripción |
|---|---|---|
| `/ejecuciones` | Server Component (`page.tsx`) | Listado global agrupado por proyecto, `loading.tsx` + `error.tsx` |
| `/ejecuciones/[id]` | Server Component (`page.tsx`) | Detalle con Server Component + `EjecucionClient` (polling) |
| `/api/ejecuciones` | Route Handler | `POST`: crear ejecución (delegar a `lib/ejecuciones/actions.ts`) |
| `/api/ejecuciones/[id]` | Route Handler | `GET`: obtener ejecución con pasos (para polling) |

---

## Validación de script antes de ejecutar

```typescript
// lib/worker/validate-script.ts
export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateScript(script: string, scriptFileName: string | null): ValidationResult {
  // 1. Script no puede estar vacío
  if (!script || script.trim() === '') {
    return { valid: false, error: 'Script vacío o no proporcionado' }
  }

  // 2. scriptFileName debe terminar en .spec.ts o .test.ts
  if (scriptFileName) {
    if (!scriptFileName.endsWith('.spec.ts') && !scriptFileName.endsWith('.test.ts')) {
      return { valid: false, error: `scriptFileName debe terminar en .spec.ts o .test.ts, recibido: ${scriptFileName}` }
    }
  }

  // 3. No intentamos parsear TypeScript — Playwright es quien valida al ejecutar
  // Si el script no es ejecutable, Playwright fallará y marcaremos errorMotor
  return { valid: true }
}
```

---

## Dependencias nuevas

```json
// package.json — devDependencies
{
  "@playwright/test": "^1.49.0"
}
```

**Nota**: `@playwright/test` es suficiente; `playwright` se instala como peer/implicit. No se necesita Redis ni message queue externo.

**Scripts a agregar**:
```json
{
  "scripts": {
    "worker": "node --import tsx scripts/worker.ts"
  }
}
```

---

## Tests

### Unitarios (Jest)

- `lib/worker/lock.test.ts` — `dispararEjecucion` rechaza segunda ejecución concurrente con 409
- `lib/worker/script-temp.test.ts` — escribe archivo temporal con nombre sanitizado, cleanup en finally
- `lib/worker/validate-script.test.ts` — script vacío → invalid, filename correcto → valid
- `lib/ejecuciones/actions.test.ts` — `dispararEjecucion` inserta `pendiente` correctamente
- `lib/ejecuciones/queries.test.ts` — `getEjecucionConPasos` ordena pasos por número

### E2E (Playwright)

- `e2e/ejecuciones.spec.ts` — flujo completo: crear caso con script válido → ejecutar → esperar `paso` o `fallo` → verificar pasos en UI
- `e2e/concurrency.spec.ts` — intentar ejecutar el mismo caso dos veces → segundo debe devolver 409

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Polling sobrecarga BD con muchos usuarios | Media | Alto | Poll de 2s es aceptable; se puede subir a 5s si el volumen lo requiere |
| Archivo temporal no se borra si el proceso crash | Baja | Medio | `finally` block garantiza cleanup; adicionalmente, cleanup al inicio del siguiente polling para casos huérfanos |
| Playwright no está en PATH del worker | Media | Alto | `@playwright/test` como devDependency + `npx` busca en `node_modules/.bin/` |
| Worker no arranca solo tras crash | Media | Bajo | Docker `restart: unless-stopped` o PM2 |
| NOWAIT falla con `lock_not_available` (Postgres espera) | Baja | Medio | Código captura error `P2024` o `lock_not_available` y convierte a `409` |
| Timeout de 5 min corta tests legítimos de larga duración | Baja | Bajo | Configurable via `playwright.config.ts`; se puede aumentar a 10 min |
| Caso con script muy pesado satura el worker | Baja | Medio | El worker es single-threaded; si hay muchos casos pesados, considerar pool de workers |
| Cliente polling cuando la ejecución ya terminó | Baja | Bajo | El cliente detecta estado terminal y para el polling automáticamente |

---

## Cobertura de los 11 ACs

| AC | Descripción | Implementación |
|---|---|---|
| AC-1 | INSERT Ejecucion(estado=pendiente) al presionar "Ejecutar" | `POST /api/ejecuciones` → `dispararEjecucion` en `lib/ejecuciones/actions.ts` |
| AC-2 | Vista se actualiza sin reload cuando pasa a "corriendo" | Polling `GET /api/ejecuciones/[id]` cada 2s en `ejecucion-client.tsx` |
| AC-3 | Estado refleja "paso" o "falló" según resultado real de Playwright | Worker actualiza `Ejecucion.estado` según resultado de `runPlaywrightTest` |
| AC-4 | Pestaña global `/ejecuciones` agrupada por proyecto | `app/(dashboard)/ejecuciones/page.tsx` con query que incluye `proyecto` |
| AC-5 | Segundo disparo bloqueado con 409 si hay ejecución en curso | `FOR UPDATE NOWAIT` en `dispararEjecucion` |
| AC-6 | Ejecución termina → próximo disparo permitido | El lock solo existe durante la transacción; al finalizar, se libera |
| AC-7 | Script vacío/inválido → `errorMotor` con mensaje en `errorMsg` | `validateScript` + `errorMotor` en worker |
| AC-8 | `errorMotor` → no muestra pasos falsos | Si `errorMotor`, se inserta un único paso con estado `fallo` y `errorMsg` del motor |
| AC-9 | Pasos aparecen sin reload (polling 2s) | `setInterval` 2000ms en `ejecucion-client.tsx` |
| AC-10 | Paso recién agregado → highlight visual ~2s | `freshStepIds` Set + `setTimeout` 2000ms + CSS `.step.new` |
| AC-11 | Pasos reflejan exactamente lo emitido, nada sintetizado | Reporter custom emite JSON por stdout; worker inserta `PasoEjecucion` sin síntesis |

---

## Configuración de Playwright

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tmp-playwright-vortex', // Directorio temporal donde worker escribe los specs
  timeout: 5 * 60 * 1000, // 5 minutos por ejecución
  retries: 0,
  workers: 1, // Un solo worker para evitar conflictos de recursos
  reporter: [], // El reporter custom se pasa por CLI
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

---

*Diseño generado por DESIGNER (kimi-k2.6) — HU-3 Motor de ejecución Playwright — Vorkan v2.1.0*
