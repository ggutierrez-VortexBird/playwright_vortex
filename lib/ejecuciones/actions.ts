'use server'

import { prisma } from '@/lib/db'
import { getSession, requireSuperadmin, NOT_FOUND_ERROR } from '@/lib/auth'

// Error marker for concurrency conflict — must be an Error instance
// so the route handler can catch it with `error instanceof Error`
export const YA_EXISTE_EJECUCION_EN_CURSO_ERROR = new Error('YA_EXISTE_EJECUCION_EN_CURSO')

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
