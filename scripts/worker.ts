// Worker de larga duración — corre en node scripts/worker.ts
import { db } from '../lib/db'
import {
  cleanupStaleScripts,
} from '../lib/worker/script-temp'
import {
  runCaseExecution,
  persistExecutionResult,
  type RunCaseResult,
} from '../lib/worker/execute-case'
import { tryClaimPendingExecution } from '../lib/worker/claim'
import type { CasoPrueba } from '@prisma/client'

const POLL_INTERVAL_MS = 5000

let shuttingDown = false

async function shutdown(signal: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[worker] ${signal} recibido, cerrando conexión a la base de datos...`)
  try {
    await db.$disconnect()
  } catch (err) {
    console.error('[worker] Error al desconectar Prisma:', err)
  } finally {
    process.exit(0)
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

async function main() {
  console.log('[worker] Arrancado, esperando ejecuciones pendientes...')

  // Cleanup inicial de scripts huérfanos
  await cleanupStaleScripts()

  while (!shuttingDown) {
    try {
      // Atomic claim: si la ejecución fue cancelada entre findFirst y updateMany,
      // tryClaimPendingExecution retorna null y seguimos al próximo poll.
      const job = await tryClaimPendingExecution(db)

      if (job) {
        console.log(`[worker] Procesando ejecución ${job.id}`)

        // Leer caso
        const caso = await db.casoPrueba.findUnique({
          where: { id: job.casoPruebaId },
          include: { parentCase: true },
        })

        if (!caso) {
          await db.ejecucion.update({
            where: { id: job.id },
            data: {
              estado: 'errorMotor',
              errorMsg: 'Caso de prueba no encontrado',
              finAt: new Date(),
            },
          })
          continue
        }

        let parentStorageState: unknown | undefined

        // HU-PARENT: si el caso tiene un padre, ejecutarlo primero para obtener
        // credenciales frescas. Si el padre falla, el hijo no se ejecuta.
        if (caso.parentCaseId && caso.parentCase) {
          console.log(`[worker] Caso ${caso.id} tiene padre ${caso.parentCaseId}. Ejecutando padre primero.`)

          const parentEjecucion = await db.ejecucion.create({
            data: {
              casoPruebaId: caso.parentCaseId,
              estado: 'corriendo',
              inicioAt: new Date(),
            },
          })
          const parentFullResult: RunCaseResult = await runCaseExecution(
            parentEjecucion.id,
            caso.parentCase
          )
          await persistExecutionResult(parentEjecucion.id, parentFullResult)

          if (parentFullResult.finalEstado !== 'paso') {
            const parentError = parentFullResult.errorMsg || `Estado final del padre: ${parentFullResult.finalEstado}`
            console.error(`[worker] Padre ${caso.parentCaseId} falló. Abortando ejecución ${job.id}: ${parentError}`)
            await db.ejecucion.update({
              where: { id: job.id },
              data: {
                estado: 'errorMotor',
                errorMsg: `El caso padre falló antes de ejecutar este caso: ${parentError}`,
                finAt: new Date(),
              },
            })
            continue
          }

          parentStorageState = parentFullResult.outputStorageState
          console.log(`[worker] Padre ${caso.parentCaseId} ejecutado correctamente. StorageState capturado: ${parentStorageState ? 'sí' : 'no'}`)
        }

        // Ejecutar el caso hijo (o el caso normal si no tiene padre)
        const childResult = await runCaseExecution(
          job.id,
          caso,
          { inputStorageState: parentStorageState }
        )

        await persistExecutionResult(job.id, childResult)

        console.log(`[worker] Ejecución ${job.id} finalizada: ${childResult.finalEstado}`)
      }
    } catch (err) {
      console.error('[worker] Error:', err)
    }

    // Cleanup periódico (cada 10 iteraciones = 50s)
    await cleanupStaleScripts().catch((err) => {
      console.error('[worker] Error en cleanupStaleScripts:', err)
    })

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch(console.error)
