'use server'

import { prisma } from '@/lib/db'
import { getSession, requireSuperadmin, NOT_FOUND_ERROR } from '@/lib/auth'
import {
  YA_EXISTE_EJECUCION_EN_CURSO_ERROR,
  EJECUCION_YA_TERMINADA_ERROR,
} from './errors'

export async function dispararEjecucion(casoPruebaId: string) {
  // 1. Require superadmin
  const session = await getSession()
  await requireSuperadmin(session)

  // 2. Check if caso exists
  const caso = await prisma.casoPrueba.findUnique({
    where: { id: casoPruebaId },
  })

  if (!caso) {
    throw NOT_FOUND_ERROR
  }

  // 3. Atomic check + create using $transaction with FOR UPDATE NOWAIT
  // Bug 3 fix: race condition between check and create is now prevented
  try {
    const ejecucion = await prisma.$transaction(async (tx) => {
      // Use $queryRaw with FOR UPDATE NOWAIT to get an exclusive lock
      // If another transaction holds the lock, this throws P2024 immediately
      await tx.$executeRaw`
        SELECT 1 FROM "Ejecucion"
        WHERE "casoPruebaId" = ${casoPruebaId}
        AND "estado" IN ('pendiente', 'corriendo')
        FOR UPDATE NOWAIT
      `

      // No lock held — create the execution
      return tx.ejecucion.create({
        data: {
          casoPruebaId,
          estado: 'pendiente',
        },
      })
    })

    return { id: ejecucion.id, estado: ejecucion.estado }
  } catch (error: unknown) {
    // Check if it's the P2024 "could not obtain lock" error from Postgres
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2024'
    ) {
      throw YA_EXISTE_EJECUCION_EN_CURSO_ERROR
    }
    // Re-throw any other error
    throw error
  }
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
 * Decisiones de producto:
 * - Cancelación dura: el worker mata el proceso Playwright (vía SIGTERM) cuando
 *   detecta el estado `cancelado` en su poll periódico.
 * - Se permite cancelar también desde `pendiente` (la ejecución aún no arrancó).
 * - NO se registra quién canceló — solo el estado terminal `cancelado`.
 */
export async function detenerEjecucion(ejecucionId: string) {
  // 1. Require superadmin
  const session = await getSession()
  await requireSuperadmin(session)

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

  return { id: ejecucionId, estado: 'cancelado' as const }
}
