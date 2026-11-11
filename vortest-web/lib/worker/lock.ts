// Anti-concurrencia con SELECT FOR UPDATE NOWAIT
import { prisma } from '@/lib/db'

export const EJECUCION_EN_CURSO_ERROR = new Error('EJECUCION_EN_CURSO')

export async function checkNoRunningExecution(
  prismaClient: typeof prisma,
  casoPruebaId: string
): Promise<void> {
  try {
    const result = await prismaClient.$queryRaw`
      SELECT 1 FROM "Ejecucion"
      WHERE "casoPruebaId" = ${casoPruebaId}
      AND "estado" IN ('pendiente', 'corriendo')
      FOR UPDATE NOWAIT
    ` as unknown[]

    if (Array.isArray(result) && result.length > 0) {
      throw EJECUCION_EN_CURSO_ERROR
    }
  } catch (error: unknown) {
    // Se revisa el código P2024 sin instanceof (funciona con mocks)
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2024'
    ) {
      throw EJECUCION_EN_CURSO_ERROR
    }
    throw error
  }
}

export async function simulateNowaitLockNotAvailable(): Promise<void> {
  // Helper de pruebas: simula el error P2024 de Postgres
  const pgError = new Error('could not obtain lock on row in relation') as Error & { code?: string; meta?: unknown }
  pgError.code = 'P2024'
  pgError.meta = { message: 'lock_not_available' }
  throw pgError
}
