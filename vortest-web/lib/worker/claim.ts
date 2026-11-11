// Toma atómica de ejecuciones pendientes (findFirst + updateMany filtrado); evita procesar una cancelada entre ambos pasos.

import type { PrismaClient } from '@prisma/client'

export interface ClaimedEjecucion {
  id: string
  casoPruebaId: string
  estado: 'corriendo'
  createdAt: Date
}

/** Toma de forma atómica la pendiente más antigua; devuelve `corriendo` o `null`. */
export async function tryClaimPendingExecution(
  db: Pick<PrismaClient, 'ejecucion'>
): Promise<ClaimedEjecucion | null> {
  // Busca la ejecución pendiente más antigua.
  const pending = await db.ejecucion.findFirst({
    where: { estado: 'pendiente' },
    orderBy: { createdAt: 'asc' },
  })

  if (!pending) {
    return null
  }

  // Toma atómica: solo si sigue pendiente; si alguien la canceló o tomó, count === 0.
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
