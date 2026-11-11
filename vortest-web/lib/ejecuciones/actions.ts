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

  // 1. Verifica que el caso exista (su proyectoId para el guard y su caso padre para el encadenamiento)
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

  // 2. Requiere superadmin, admin del espacio o tester con acceso al proyecto
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

  // 4. Despacho por RabbitMQ: se publica acá el job del caso (o del padre); el del hijo lo publica el consumer vía `Ejecucion.pendingChildEjecucionId`.

  // La fila pasa a 'corriendo' al publicar.
  await prisma.ejecucion.update({
    where: { id: ejecucion.id },
    data: { estado: 'corriendo', inicioAt: new Date() },
  })
  let finalEstado: string = 'corriendo'

  if (caso.parentCaseId && caso.parentCase) {
    // Publica el job del PADRE ahora; el hijo espera el `end` del padre en execution-consumer. Se declara fuera del try para marcar la fila del padre si falla.
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

/** Cancela una ejecución pendiente o corriendo (updateMany atómico filtrado por estado) y avisa al motor; un error de red solo se loguea. */
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

  // 2. Transición atómica: solo pendiente|corriendo → cancelado
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

  // 3. Si updateMany afectó 0 filas, se distingue "no existe" de "ya terminal"
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

  // 4. Si era un padre con un hijo esperando, cancelarlo no genera `end`: se resuelve al hijo acá, si sigue en estado no terminal.
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

  // 5. Push al motor; nunca debe hacer fallar la acción, el estado ya quedó 'cancelado' en el paso 2.
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

// Si el motor responde 404 el job puede estar aún en cola: se reintenta con backoff corto (3 intentos) y nunca lanza.
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
      // 404: ninguna réplica tiene el job (todavía o ya terminó); reintentar
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
