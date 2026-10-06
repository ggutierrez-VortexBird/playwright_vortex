// Consumidor de larga duración — corre en `node --import tsx
// scripts/execution-consumer.ts`. Reemplaza a scripts/worker.ts: en vez de
// hacer polling sobre la tabla Ejecucion cada 5s, se suscribe a la cola
// `engine.events` (RabbitMQ) y persiste en DB cada evento que vortest-engine
// publica en tiempo real. También publica a `engine.execute` el job del
// caso HIJO en el encadenamiento padre/hijo, una vez que ve el evento `end`
// del padre (ver lib/ejecuciones/actions.ts::dispararEjecucion para la otra
// mitad de esta orquestación — quién publica el job del padre).
//
// SUPUESTO DE INSTANCIA ÚNICA (heredado del worker.ts original, que también
// corría como un único proceso): los buffers en memoria de este archivo
// (pendingSubsteps) asumen que TODOS los eventos de un mismo jobId los
// procesa esta misma instancia del proceso. Si algún día se corren réplicas
// del consumer para escalar el consumo de `engine.events`, RabbitMQ
// distribuiría eventos del mismo job entre réplicas distintas (competing
// consumers no garantiza afinidad por jobId) y este buffering se rompería —
// habría que mover el buffer a Redis/DB. No es un problema hoy porque este
// proceso, igual que el worker viejo, se despliega como instancia única.
import { prisma } from '../lib/db'
import { Prisma } from '@prisma/client'
import { consumeEngineEvents, publishExecuteJob } from '../lib/queue/rabbitmq'
import { buildScriptText } from '../lib/worker/script-temp'
import { linkCollectedArtifacts, linkCapturaTestToLastSubaccion } from '../lib/worker/artifacts'
import type {
  EngineEvent,
  EngineEventPayload,
  StepEventPayload,
  SubstepEventPayload,
  EndEventPayload,
} from '../lib/queue/engine-contract'

const DEFAULT_SCRIPT_FILE_NAME = 'test.spec.ts'
const EJECUCION_TIMEOUT_MS = Number(process.env.EJECUCION_TIMEOUT_MS) || 10 * 60 * 1000
const WATCHDOG_INTERVAL_MS = 60_000
const WATCHDOG_GRACE_MS = 2 * 60_000

let shuttingDown = false
let closeConsumer: (() => Promise<void>) | undefined
let watchdogTimer: ReturnType<typeof setInterval>

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[execution-consumer] ${signal} recibido, cerrando...`)
  try {
    clearInterval(watchdogTimer)
    await closeConsumer?.()
    await prisma.$disconnect()
  } catch (err) {
    console.error('[execution-consumer] Error al cerrar:', err)
  } finally {
    process.exit(0)
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

// ============================================================
// Buffer de substeps que llegan antes que su PasoEjecucion padre exista
// (nota #5 del encargo — mismo problema que pendingSubsteps en el runner.ts
// original, ahora entre procesos: la publicación de un evento `substep` del
// motor se difiere hasta que termina de subir sus capturas, mientras que el
// evento `step` (resumen del test) del reporter llega recién al final del
// test — así que en el caso común el substep SÍ llega antes que su step).
// Clave: `${jobId}:${parentNumero}`.
// ============================================================
const pendingSubsteps = new Map<string, SubstepEventPayload[]>()

function bufferKey(jobId: string, parentNumero: number): string {
  return `${jobId}:${parentNumero}`
}

function clearJobBuffers(jobId: string): void {
  const prefix = `${jobId}:`
  for (const key of pendingSubsteps.keys()) {
    if (key.startsWith(prefix)) pendingSubsteps.delete(key)
  }
}

// ============================================================
// Handlers por tipo de evento — cada uno es el equivalente directo de un
// handler de lib/worker/runner.ts (ahora vortest-engine/src/execution/
// runner.ts), pero escribiendo a Postgres en vez de mutar estado local.
// ============================================================

async function upsertPasoEjecucion(jobId: string, payload: StepEventPayload): Promise<void> {
  await prisma.pasoEjecucion
    .upsert({
      where: { ejecucionId_numero: { ejecucionId: jobId, numero: payload.numero } },
      create: {
        ejecucionId: jobId,
        numero: payload.numero,
        descripcion: payload.descripcion,
        estado: payload.estado,
        duracionMs: payload.duracionMs,
        errorMsg: payload.errorMsg,
        resultadoEsperado: payload.resultadoEsperado,
        resultadoObtenido: payload.resultadoObtenido,
        errorCount: payload.errorCount,
        videoInicioMs: payload.videoInicioMs,
        videoFinMs: payload.videoFinMs,
        logs: payload.logs ? (payload.logs as unknown as Prisma.InputJsonValue) : undefined,
      },
      update: {
        descripcion: payload.descripcion,
        estado: payload.estado,
        duracionMs: payload.duracionMs,
        errorMsg: payload.errorMsg,
        resultadoEsperado: payload.resultadoEsperado,
        resultadoObtenido: payload.resultadoObtenido,
        errorCount: payload.errorCount,
        videoInicioMs: payload.videoInicioMs,
        videoFinMs: payload.videoFinMs,
        logs: payload.logs ? (payload.logs as unknown as Prisma.InputJsonValue) : undefined,
      },
    })
    .catch((err) => {
      console.error(`[execution-consumer] Error upsert PasoEjecucion #${payload.numero} (job ${jobId}):`, err)
    })

  // Flush de substeps que llegaron antes que este paso existiera.
  const key = bufferKey(jobId, payload.numero)
  const buffered = pendingSubsteps.get(key)
  if (buffered && buffered.length > 0) {
    pendingSubsteps.delete(key)
    for (const substep of buffered) {
      await persistSubstep(jobId, substep)
    }
  }
}

async function persistSubstep(jobId: string, payload: SubstepEventPayload): Promise<void> {
  const paso = await prisma.pasoEjecucion
    .findUnique({
      where: { ejecucionId_numero: { ejecucionId: jobId, numero: payload.parentTestId } },
      select: { id: true },
    })
    .catch(() => null)

  if (!paso) {
    // El step padre todavía no existe — bufferear hasta que
    // upsertPasoEjecucion lo cree y haga el flush.
    const key = bufferKey(jobId, payload.parentTestId)
    const pending = pendingSubsteps.get(key) ?? []
    pending.push(payload)
    pendingSubsteps.set(key, pending)
    return
  }

  // No hay una constraint UNIQUE(ejecucionId, pasoEjecucionId, numero) en el
  // schema para este modelo (a diferencia de PasoEjecucion), así que el
  // "upsert" es manual: buscar y crear/actualizar. Con este proceso corriendo
  // como instancia única y prefetch=1 (ver lib/queue/rabbitmq.ts), no hay
  // concurrencia real entre mensajes — es seguro.
  const existing = await prisma.pasoSubaccion
    .findFirst({
      where: { ejecucionId: jobId, pasoEjecucionId: paso.id, numero: payload.numero },
      select: { id: true },
    })
    .catch(() => null)

  const data = {
    tipo: payload.tipo,
    descripcion: payload.descripcion,
    estado: payload.estado,
    duracionMs: payload.duracionMs,
    errorMsg: payload.errorMsg,
    logs: payload.logs ? (payload.logs as unknown as Prisma.InputJsonValue) : undefined,
    capturaActualId: payload.capturaActualToken,
    capturaReferenciaId: payload.capturaReferenciaToken,
  }

  if (existing) {
    await prisma.pasoSubaccion.update({ where: { id: existing.id }, data }).catch((err) => {
      console.error(`[execution-consumer] Error actualizando PasoSubaccion #${payload.numero} (job ${jobId}):`, err)
    })
  } else {
    await prisma.pasoSubaccion
      .create({
        data: {
          ejecucionId: jobId,
          pasoEjecucionId: paso.id,
          numero: payload.numero,
          ...data,
        },
      })
      .catch((err) => {
        console.error(`[execution-consumer] Error creando PasoSubaccion #${payload.numero} (job ${jobId}):`, err)
      })
  }
}

/**
 * Publica el job del caso HIJO ahora que su padre terminó 'paso', o lo
 * marca 'errorMotor' sin publicarlo si el padre falló. Mitad de la
 * orquestación padre/hijo que vive en este proceso — ver
 * lib/ejecuciones/actions.ts::dispararEjecucion para la otra mitad (quién
 * publica el job del padre y deja el rastro en `pendingChildEjecucionId`).
 */
async function handlePendingChild(childId: string, parentEnd: EndEventPayload): Promise<void> {
  if (parentEnd.estado === 'paso') {
    const child = await prisma.ejecucion.findUnique({
      where: { id: childId },
      include: { casoPrueba: { include: { sesiones: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
    })

    if (!child) {
      console.error(`[execution-consumer] Hijo pendiente ${childId} no existe — no se puede despachar`)
      return
    }

    // Guard atómico: solo despachar si el hijo sigue en el estado en que
    // dispararEjecucion lo dejó ('corriendo', esperando al padre). Si el
    // usuario lo canceló mientras tanto, ya no está en 'corriendo'.
    const guard = await prisma.ejecucion.updateMany({
      where: { id: childId, estado: 'corriendo' },
      data: { estado: 'corriendo' },
    })
    if (guard.count === 0) {
      console.log(`[execution-consumer] Hijo ${childId} ya no está 'corriendo' (cancelado?) — no se despacha`)
      return
    }

    try {
      await publishExecuteJob({
        jobId: child.id,
        scriptText: buildScriptText(child.casoPrueba.script),
        scriptFileName: child.casoPrueba.scriptFileName ?? DEFAULT_SCRIPT_FILE_NAME,
        inputStorageState: parentEnd.outputStorageState,
        timeoutMs: EJECUCION_TIMEOUT_MS,
        publishedAt: new Date().toISOString(),
        // Sin navegador el motor no pasa --project y Playwright corre el caso en los 3 navegadores; misma regla que el padre en dispararEjecucion.
        navegador: (child.casoPrueba.sesiones[0]?.navegador ?? 'chromium') as 'chromium' | 'firefox' | 'webkit',
      })
      console.log(`[execution-consumer] Job del hijo ${child.id} publicado tras padre exitoso`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`[execution-consumer] Error publicando job del hijo ${child.id}:`, err)
      await prisma.ejecucion
        .update({
          where: { id: child.id },
          data: {
            estado: 'errorMotor',
            finAt: new Date(),
            errorMsg: `No se pudo encolar la ejecución del hijo tras el padre: ${detail}`,
          },
        })
        .catch(() => undefined)
    }
    return
  }

  // Padre falló ('fallo' o 'errorMotor') — el hijo no se ejecuta. Mismo
  // mensaje/semántica que scripts/worker.ts:87-98 original.
  const parentError = parentEnd.errorMsg || `Estado final del padre: ${parentEnd.estado}`
  await prisma.ejecucion
    .updateMany({
      where: { id: childId, estado: { in: ['pendiente', 'corriendo'] } },
      data: {
        estado: 'errorMotor',
        finAt: new Date(),
        errorMsg: `El caso padre falló antes de ejecutar este caso: ${parentError}`,
      },
    })
    .catch((err) => {
      console.error(`[execution-consumer] Error marcando hijo ${childId} tras fallo del padre:`, err)
    })
}

async function handleEnd(jobId: string, payload: EndEventPayload): Promise<void> {
  // Guard atómico: solo aplicar el resultado si la Ejecucion sigue
  // 'corriendo'. Si ya está en un estado terminal (p.ej. 'cancelado',
  // marcado optimistamente por detenerEjecucion), un evento `end` tardío
  // (carrera cancelación vs. motor terminando en el mismo instante) NO debe
  // pisar ese resultado — el usuario ya vio "cancelado".
  const current = await prisma.ejecucion.findUnique({
    where: { id: jobId },
    select: { pendingChildEjecucionId: true },
  })
  if (!current) {
    console.error(`[execution-consumer] Evento 'end' para Ejecucion inexistente ${jobId} — ignorado`)
    clearJobBuffers(jobId)
    return
  }

  const updated = await prisma.ejecucion.updateMany({
    where: { id: jobId, estado: 'corriendo' },
    data: {
      estado: payload.estado,
      finAt: new Date(),
      duracionMs: payload.duracionMs,
      errorMsg: payload.errorMsg ?? null,
      storageState: payload.outputStorageState
        ? (payload.outputStorageState as Prisma.InputJsonValue)
        : Prisma.DbNull,
      asercionesTotal: payload.asercionesTotal,
      asercionesOk: payload.asercionesOk,
      asercionesFail: payload.asercionesFail,
    },
  })

  if (updated.count === 0) {
    console.warn(
      `[execution-consumer] Ejecucion ${jobId} ya no estaba 'corriendo' al recibir 'end' (estado terminal previo) — resultado descartado`
    )
  } else if (payload.artifactUploadFailed) {
    console.warn(`[execution-consumer] Job ${jobId} terminó con artifactUploadFailed=true`)
  }

  // La vinculación de artefactos se intenta igual que el `collectArtifacts`
  // original: sin importar si el resultado fue 'paso' o 'fallo' (interesa
  // ver capturas también en fallos).
  if (payload.artefactos && payload.artefactos.length > 0) {
    await linkCollectedArtifacts(jobId, payload.artefactos).catch((err) => {
      console.error(`[execution-consumer] Error vinculando artefactos recolectados para ${jobId}:`, err)
    })
  }

  // Solo disparar la cascada padre/hijo si el `end` realmente se aplicó —
  // si la fila ya estaba terminal (ej. cancelada), detenerEjecucion ya
  // resolvió al hijo pendiente en el momento de la cancelación (ver lib/
  // ejecuciones/actions.ts) y no hay nada más que hacer acá.
  if (updated.count > 0 && current.pendingChildEjecucionId) {
    await handlePendingChild(current.pendingChildEjecucionId, payload)
  }

  clearJobBuffers(jobId)
}

async function dispatch(event: EngineEvent<EngineEventPayload>): Promise<void> {
  const { jobId, payload } = event

  switch (payload.type) {
    case 'env':
      // El runner original (lib/worker/runner.ts::handleEnvEvent) persistía
      // navegador/SO/nodo en la Ejecucion; se conserva ese comportamiento.
      await prisma.ejecucion
        .update({
          where: { id: jobId },
          data: {
            navegador: payload.navegador,
            sistemaOperativo: payload.sistemaOperativo,
            nodoEjecucion: payload.nodoEjecucion,
          },
        })
        .catch((err) => console.error('[execution-consumer] Error guardando env:', err))
      break
    case 'step':
      await upsertPasoEjecucion(jobId, payload)
      break
    case 'substep':
      await persistSubstep(jobId, payload)
      break
    case 'log':
      // Los logs ya viajan capados y embebidos en los eventos 'step'/
      // 'substep' (StepEventPayload.logs / SubstepEventPayload.logs, ya
      // acotados por el motor). El evento 'log' individual es un relay en
      // vivo sin efecto en DB propio, igual que el NDJSON de log del
      // reporter original no se persistía por sí solo.
      break
    case 'assertion':
      // Sin efecto en DB: el motor ya agrega los contadores finales
      // (asercionesTotal/Ok/Fail) y los manda completos en el evento `end`.
      break
    case 'captura-test':
      await linkCapturaTestToLastSubaccion(
        jobId,
        payload.parentTestId,
        payload.capturaActualToken ?? null,
        payload.capturaReferenciaToken ?? null,
      )
      break
    case 'end':
      await handleEnd(jobId, payload)
      break
  }
}

async function main(): Promise<void> {
  console.log('[execution-consumer] Arrancado, esperando eventos de engine.events...')

  // Watchdog: mark stuck executions as errorMotor
  watchdogTimer = setInterval(async () => {
    try {
      const stuckThreshold = Date.now() - (EJECUCION_TIMEOUT_MS + WATCHDOG_GRACE_MS)
      const stuckEjecuciones = await prisma.ejecucion.findMany({
        where: {
          estado: 'corriendo',
          inicioAt: { lt: new Date(stuckThreshold) },
        },
        select: { id: true },
      })

      for (const stuck of stuckEjecuciones) {
        console.warn(`[watchdog] Ejecución ${stuck.id} colgada, marcando errorMotor`)
        await prisma.ejecucion.update({
          where: { id: stuck.id },
          data: {
            estado: 'errorMotor',
            finAt: new Date(),
            errorMsg: 'Ejecución colgada: watchdog detectó que estaba corriendo sin actividad.',
          },
        })
        clearJobBuffers(stuck.id)
      }
    } catch (err) {
      console.error('[watchdog] Error en el watchdog:', err)
    }
  }, WATCHDOG_INTERVAL_MS)
  watchdogTimer.unref()

  closeConsumer = await consumeEngineEvents(async (event) => {
    try {
      await dispatch(event)
    } catch (err) {
      console.error(`[execution-consumer] Error procesando evento ${event.payload.type} (job ${event.jobId}):`, err)
      throw err
    }
  })
}

main().catch((err) => {
  console.error('[execution-consumer] Error fatal:', err)
  process.exit(1)
})
