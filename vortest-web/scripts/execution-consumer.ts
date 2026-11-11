// Consumidor de engine.events (RabbitMQ): persiste cada evento del motor en DB y publica el job del hijo al ver el `end` del padre; asume una sola instancia.
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

// Buffer de substeps que llegan antes que su PasoEjecucion padre; clave `${jobId}:${parentNumero}`
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

// Handlers por tipo de evento; escriben a Postgres

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

  // Flush de substeps que llegaron antes que su paso
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
    // El step padre aún no existe: se bufferea hasta que upsertPasoEjecucion lo cree y haga el flush
    const key = bufferKey(jobId, payload.parentTestId)
    const pending = pendingSubsteps.get(key) ?? []
    pending.push(payload)
    pendingSubsteps.set(key, pending)
    return
  }

  // No hay UNIQUE(ejecucionId, pasoEjecucionId, numero) en este modelo, así que el "upsert" es manual; es seguro con instancia única y prefetch=1.
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

/** Publica el job del hijo cuando su padre terminó 'paso', o lo marca 'errorMotor' si el padre falló. */
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

    // Guard atómico: solo se despacha si el hijo sigue 'corriendo' (esperando al padre); si lo canceló el usuario, no.
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

  // Padre falló ('fallo' o 'errorMotor'): el hijo no se ejecuta
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
  // Guard atómico: solo se aplica el resultado si sigue 'corriendo'; un `end` tardío no debe pisar un 'cancelado'.
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

  // Se vinculan los artefactos tanto en 'paso' como en 'fallo' (interesan las capturas de los fallos)
  if (payload.artefactos && payload.artefactos.length > 0) {
    await linkCollectedArtifacts(jobId, payload.artefactos).catch((err) => {
      console.error(`[execution-consumer] Error vinculando artefactos recolectados para ${jobId}:`, err)
    })
  }

  // Solo se dispara la cascada padre/hijo si el `end` se aplicó; si ya estaba terminal, detenerEjecucion resolvió al hijo.
  if (updated.count > 0 && current.pendingChildEjecucionId) {
    // CAS sobre pendingChildEjecucionId: sólo quien logra limpiarlo despacha al hijo, así un 'end' repetido no lo lanza dos veces.
    const tomado = await prisma.ejecucion.updateMany({
      where: { id: jobId, pendingChildEjecucionId: current.pendingChildEjecucionId },
      data: { pendingChildEjecucionId: null },
    })
    if (tomado.count === 1) await handlePendingChild(current.pendingChildEjecucionId, payload)
  }

  clearJobBuffers(jobId)
}

async function dispatch(event: EngineEvent<EngineEventPayload>): Promise<void> {
  const { jobId, payload } = event

  switch (payload.type) {
    case 'env':
      // Se persiste navegador/SO/nodo en la Ejecucion
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
      // Los logs ya viajan capados dentro de los eventos 'step'/'substep'; el evento 'log' es solo un relay en vivo
      break
    case 'assertion':
      // Sin efecto en DB: el motor manda los contadores finales completos en el evento `end`
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

  // Watchdog: marca como errorMotor las ejecuciones colgadas
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
        // Solo si sigue 'corriendo': si el 'end' llegó entre la consulta y este update, no se pisa el resultado real.
        const { count } = await prisma.ejecucion.updateMany({
          where: { id: stuck.id, estado: 'corriendo' },
          data: {
            estado: 'errorMotor',
            finAt: new Date(),
            errorMsg: 'Ejecución colgada: watchdog detectó que estaba corriendo sin actividad.',
          },
        })
        if (count === 0) continue
        console.warn(`[watchdog] Ejecución ${stuck.id} colgada, marcada errorMotor`)
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
