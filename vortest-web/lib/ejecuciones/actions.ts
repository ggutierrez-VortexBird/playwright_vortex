'use server'

import { prisma } from '@/lib/db'
import { getSession, requireProyectoAccess, NOT_FOUND_ERROR } from '@/lib/auth'
import { publishExecuteJob } from '@/lib/queue/rabbitmq'
import { env } from '@/lib/env'
import {
  YA_EXISTE_EJECUCION_EN_CURSO_ERROR,
  EJECUCION_YA_TERMINADA_ERROR,
} from './errors'
import { buildExecuteJob, markPublishFailed, storageStateDeCredencialDelCaso } from './dispatch'

export async function dispararEjecucion(casoPruebaId: string) {
  const session = await getSession()

  // 1. Check if caso exists (necesitamos su proyectoId para el guard de acceso,
  // y su parentCase para decidir el encadenamiento).
  const caso = await prisma.casoPrueba.findUnique({
    where: { id: casoPruebaId },
    include: {
      parentCase: true,
      sesiones: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  if (!caso) {
    throw NOT_FOUND_ERROR
  }

  // 2. Requiere superadmin, admin del espacio del proyecto, o tester con acceso
  await requireProyectoAccess(session, caso.proyectoId)

  // 3. Chequeo + alta atómicos: nunca dos ejecuciones en curso del mismo caso.
  const ejecucion: { id: string; estado: string } = await prisma.$transaction(async (tx) => {
    // Lock por caso + conteo en la misma transacción: el FOR UPDATE anterior ignoraba sus filas y dejaba ejecutar el mismo caso dos veces.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${casoPruebaId}))`
    const enCurso = await tx.ejecucion.count({
      where: { casoPruebaId, estado: { in: ['pendiente', 'corriendo'] } },
    })
    if (enCurso > 0) throw YA_EXISTE_EJECUCION_EN_CURSO_ERROR

    return tx.ejecucion.create({
      data: {
        casoPruebaId,
        estado: 'pendiente',
      },
    })
  })

  // 4. Despacho — motor Fase 1 (RabbitMQ), dirigido por eventos, no polling.
  //
  // Decisión de diseño (dispatch-publishing): se publica DIRECTO desde acá
  // para todo lo que se conoce de antemano en este mismo request — tanto el
  // caso sin padre (jobId = ejecucion.id) COMO el caso CON padre (acá se
  // publica el job del PADRE inmediatamente). Lo único que se difiere al
  // consumidor (scripts/execution-consumer.ts) es publicar el job del HIJO,
  // porque eso depende de un evento asíncrono (el `end` del padre) que este
  // request no puede esperar de forma síncrona sin bloquear la respuesta al
  // usuario — exactamente la misma razón por la que esto vivía en un proceso
  // de background aparte (scripts/worker.ts) antes de este refactor.
  //
  // El link "esta fila-padre tiene un hijo esperando" se persiste en
  // `Ejecucion.pendingChildEjecucionId` (no en un Map en memoria) porque
  // dispararEjecucion corre en el proceso Next.js y quien reacciona al
  // evento `end` del padre corre en scripts/execution-consumer.ts — un
  // proceso completamente distinto. Ver la migración
  // 20260922120000_add_ejecucion_pending_child para el razonamiento completo.

  // Igual que hacía tryClaimPendingExecution del worker viejo: la fila pasa a
  // 'corriendo' apenas se "toma" el trabajo — ahora eso ocurre acá, al
  // publicar, en vez de en el próximo poll (hasta 5s después, antes).
  await prisma.ejecucion.update({
    where: { id: ejecucion.id },
    data: { estado: 'corriendo', inicioAt: new Date() },
  })
  let finalEstado: string = 'corriendo'

  if (caso.parentCaseId && caso.parentCase) {
    // HU-PARENT: publicar el job del PADRE ahora; el hijo (ejecucion.id, ya
    // 'corriendo' desde el punto de vista del usuario) espera a que
    // execution-consumer.ts vea el `end` del padre.
    // [FIA-01] Declarado fuera del try para que el catch pueda marcar la fila
    // del padre si llegó a crearse (si no, quedaría 'corriendo' para siempre
    // y bloquearía el caso padre por el guard anti-concurrencia).
    let parentEjecucion: { id: string } | null = null
    try {
      parentEjecucion = await prisma.ejecucion.create({
        data: {
          casoPruebaId: caso.parentCaseId,
          estado: 'corriendo',
          inicioAt: new Date(),
          pendingChildEjecucionId: ejecucion.id,
        },
      })

      await publishExecuteJob(
        buildExecuteJob({
          jobId: parentEjecucion.id,
          script: caso.parentCase.script,
          scriptFileName: caso.parentCase.scriptFileName,
          inputStorageState: await storageStateDeCredencialDelCaso(caso.parentCaseId),
          navegador: caso.sesiones[0]?.navegador ?? 'chromium',
        })
      )
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`[dispararEjecucion] Error publicando job del caso padre para ${ejecucion.id}:`, err)
      if (parentEjecucion) await markPublishFailed(parentEjecucion.id, detail, err)
      await markPublishFailed(ejecucion.id, `El caso padre no pudo encolarse: ${detail}`, err)
      finalEstado = 'errorMotor'
    }
  } else {
    try {
      await publishExecuteJob(
        buildExecuteJob({
          jobId: ejecucion.id,
          script: caso.script,
          scriptFileName: caso.scriptFileName,
          inputStorageState: await storageStateDeCredencialDelCaso(caso.id),
          navegador: caso.sesiones[0]?.navegador ?? 'chromium',
        })
      )
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`[dispararEjecucion] Error publicando job para ${ejecucion.id}:`, err)
      await markPublishFailed(ejecucion.id, detail, err)
      finalEstado = 'errorMotor'
    }
  }

  return { id: ejecucion.id, estado: finalEstado }
}

/**
 * Cancela una ejecución que esté en estado `pendiente` o `corriendo`.
 *
 * Implementación atómica con `updateMany` + filtro por estado:
 * - Si `updateMany` afecta 1 fila: la ejecución era activa y se canceló OK.
 * - Si `updateMany` afecta 0 filas: o no existe, o ya está terminal
 *   (`paso`, `fallo`, `reparado`, `errorMotor`, `cancelado`).
 *   Se distingue con un `findUnique` adicional: si no existe → NOT_FOUND_ERROR;
 *   si existe → EJECUCION_YA_TERMINADA_ERROR.
 *
 * Decisiones de producto (sin cambios respecto a la versión pre-motor):
 * - Cancelación dura: ahora empuja un POST al motor (push), en vez de que el
 *   worker viejo detectara el estado `cancelado` en su poll periódico.
 * - Se permite cancelar también desde `pendiente` (la ejecución aún no arrancó,
 *   o — nuevo caso — es un hijo esperando a que su padre termine).
 * - NO se registra quién canceló — solo el estado terminal `cancelado`.
 *
 * Motor Fase 1: después de la MISMA actualización optimista de siempre, se
 * llama POST {ENGINE_INTERNAL_URL}/internal/cancel/:ejecucionId. Tanto
 * 200 {cancelled:true} como 404 {cancelled:false} son éxito desde acá (404
 * solo significa que esta réplica del motor no tenía ese job — benigno). Un
 * error de red NO debe hacer fallar detenerEjecucion — el estado ya quedó
 * 'cancelado' en DB pase lo que pase con el motor; solo se loggea.
 */
export async function detenerEjecucion(ejecucionId: string) {
  const session = await getSession()

  // 1. Resolver el proyecto dueño de la ejecución para el guard de acceso
  const ejecucion = await prisma.ejecucion.findUnique({
    where: { id: ejecucionId },
    select: {
      casoPrueba: { select: { proyectoId: true } },
      pendingChildEjecucionId: true,
    },
  })
  if (!ejecucion) {
    throw NOT_FOUND_ERROR
  }
  await requireProyectoAccess(session, ejecucion.casoPrueba.proyectoId)

  // 2. Transición atómica de estado: solo pendiente|corriendo → cancelado
  const result = await prisma.ejecucion.updateMany({
    where: {
      id: ejecucionId,
      estado: { in: ['pendiente', 'corriendo'] },
    },
    data: {
      estado: 'cancelado',
      finAt: new Date(),
    },
  })

  // 3. Si updateMany afectó 0 filas, distinguimos "no existe" vs "ya terminal"
  if (result.count === 0) {
    const exists = await prisma.ejecucion.findUnique({
      where: { id: ejecucionId },
      select: { id: true },
    })
    if (!exists) {
      throw NOT_FOUND_ERROR
    }
    throw EJECUCION_YA_TERMINADA_ERROR
  }

  // 4. Si esta fila era un padre sintetizado con un hijo esperando (ver
  // dispararEjecucion), cancelar al padre nunca generará el evento `end`
  // que el consumer necesita para decidir el destino del hijo (el motor no
  // emite `end` para jobs cancelados — ver nota en la arquitectura). Sin
  // este paso, el hijo quedaría 'corriendo' para siempre. Solo tocamos al
  // hijo si sigue en un estado no-terminal (pudo haber sido cancelado
  // independientemente por el usuario, o ya haber arrancado si hubo una
  // carrera con el consumer).
  if (ejecucion.pendingChildEjecucionId) {
    await prisma.ejecucion
      .updateMany({
        where: {
          id: ejecucion.pendingChildEjecucionId,
          estado: { in: ['pendiente', 'corriendo'] },
        },
        data: {
          estado: 'errorMotor',
          finAt: new Date(),
          errorMsg: 'El caso padre fue cancelado antes de ejecutar este caso.',
        },
      })
      .catch((err) => {
        console.error(
          `[detenerEjecucion] Error propagando cancelación del padre ${ejecucionId} a su hijo pendiente:`,
          err
        )
      })
  }

  // 5. Push al motor. Nunca debe hacer fallar la Server Action — el estado
  // ya quedó 'cancelado' en el paso 2 sin importar qué pase acá.
  const engineUrl = env.ENGINE_INTERNAL_URL
  const engineSecret = env.ENGINE_INTERNAL_SECRET
  if (engineUrl && engineSecret) {
    await notifyEngineCancel(engineUrl, engineSecret, ejecucionId)
  } else {
    console.warn(
      `[detenerEjecucion] ENGINE_INTERNAL_URL/ENGINE_INTERNAL_SECRET no configurados — no se notificó al motor sobre la cancelación de ${ejecucionId}`
    )
  }

  return { id: ejecucionId, estado: 'cancelado' as const }
}

// [FIA-07] Mitigación: si el motor responde 404 puede ser que el job todavía
// esté en la cola o entre "recibido" y "registrado". Se reintenta la
// cancelación con backoff corto (0s, 1s, 2s: 3 intentos). Nunca lanza: el
// estado 'cancelado' en DB ya es definitivo y optimista.
const CANCEL_MAX_ATTEMPTS = 3
const CANCEL_BACKOFF_MS = [1000, 2000]

async function notifyEngineCancel(engineUrl: string, engineSecret: string, ejecucionId: string): Promise<void> {
  const url = `${engineUrl.replace(/\/$/, '')}/internal/cancel/${ejecucionId}`
  for (let attempt = 1; attempt <= CANCEL_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'X-Internal-Secret': engineSecret } })
      if (response.status === 200) return
      if (response.status !== 404) {
        console.error(`[detenerEjecucion] Respuesta inesperada del motor al cancelar ${ejecucionId}: ${response.status}`)
        return
      }
      // 404: ninguna réplica tiene el job (todavía o ya terminó). Reintentar.
      if (attempt === CANCEL_MAX_ATTEMPTS) {
        console.warn(
          `[detenerEjecucion] El motor respondió 404 al cancelar ${ejecucionId} tras ${attempt} intentos (job no registrado o ya terminado)`
        )
        return
      }
    } catch (err) {
      console.error(`[detenerEjecucion] Error de red al notificar cancelación al motor para ${ejecucionId}:`, err)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, CANCEL_BACKOFF_MS[attempt - 1]))
  }
}
