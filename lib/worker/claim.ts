// Atomic claim of pending executions for the worker.
// Encapsulates the race-condition-safe pattern: findFirst + updateMany-with-filter.
// If between findFirst and updateMany someone cancels the execution, updateMany
// affects 0 rows and we return null (worker should skip and poll again).
//
// AC-7 (cancelación durante el poll): este helper es la pieza que evita que el
// worker procese una ejecución que fue cancelada por el usuario entre el
// `findFirst` y la toma efectiva.

import type { PrismaClient } from '@prisma/client'

export interface ClaimedEjecucion {
  id: string
  casoPruebaId: string
  estado: 'corriendo'
  createdAt: Date
}

/**
 * Intenta tomar la ejecución pendiente más antigua de forma atómica.
 *
 * @returns La ejecución ya marcada como `corriendo`, o `null` si no hay
 *          pendientes o si fue cancelada/tomada por otro worker.
 */
export async function tryClaimPendingExecution(
  db: Pick<PrismaClient, 'ejecucion'>
): Promise<ClaimedEjecucion | null> {
  // 1. Buscar la ejecución pendiente más antigua.
  const pending = await db.ejecucion.findFirst({
    where: { estado: 'pendiente' },
    orderBy: { createdAt: 'asc' },
  })

  if (!pending) {
    return null
  }

  // 2. Intentar "tomarla" atómicamente: solo si sigue pendiente.
  // Si entre (1) y (2) alguien la canceló o la tomó otro worker, count === 0.
  const claimed = await db.ejecucion.updateMany({
    where: { id: pending.id, estado: 'pendiente' },
    data: { estado: 'corriendo', inicioAt: new Date() },
  })

  if (claimed.count === 0) {
    return null
  }

  return {
    id: pending.id,
    casoPruebaId: pending.casoPruebaId,
    estado: 'corriendo',
    createdAt: pending.createdAt,
  }
}
