// Check anti-concurrencia con SELECT FOR UPDATE NOWAIT
import { prisma } from '@/lib/db'

export const EJECUCION_EN_CURSO_ERROR = new Error('EJECUCION_EN_CURSO')

export async function checkNoRunningExecution(
  prismaClient: typeof prisma,
  casoPruebaId: string
): Promise<void> {
  try {
    // Usar $queryRaw para el FOR UPDATE NOWAIT
    const result = await prismaClient.$queryRaw`
      SELECT 1 FROM "Ejecucion"
      WHERE "casoPruebaId" = ${casoPruebaId}
      AND "estado" IN ('pendiente', 'corriendo')
      FOR UPDATE NOWAIT
    ` as unknown[]

    // If rows are returned, there's a running execution
    if (Array.isArray(result) && result.length > 0) {
      throw EJECUCION_EN_CURSO_ERROR
    }
  } catch (error: unknown) {
    // Check for P2024 error code without using instanceof (works with mocks)
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
  // Helper for testing - simulates Postgres P2024 error
  const pgError = new Error('could not obtain lock on row in relation') as any
  pgError.code = 'P2024'
  pgError.meta = { message: 'lock_not_available' }
  throw pgError
}
