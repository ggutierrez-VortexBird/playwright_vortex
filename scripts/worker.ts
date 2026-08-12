// Worker de larga duración — corre en node scripts/worker.ts
import { db } from '../lib/db'
import {
  writeTempScript,
  cleanupTempScript,
  cleanupStaleScripts,
} from '../lib/worker/script-temp'
import { validateScript } from '../lib/worker/validate-script'
import { runPlaywrightTest } from '../lib/worker/runner'

const POLL_INTERVAL_MS = 5000

async function main() {
  console.log('[worker] Arrancado, esperando ejecuciones pendientes...')

  // Cleanup inicial de scripts huérfanos
  await cleanupStaleScripts()

  while (true) {
    try {
      // Buscar ejecución pendiente
      const job = await db.ejecucion.findFirst({
        where: { estado: 'pendiente' },
        orderBy: { createdAt: 'asc' },
      })

      if (job) {
        console.log(`[worker] Procesando ejecución ${job.id}`)

        // Marcar como corriendo
        await db.ejecucion.update({
          where: { id: job.id },
          data: { estado: 'corriendo', inicioAt: new Date() },
        })

        // Leer caso
        const caso = await db.casoPrueba.findUnique({
          where: { id: job.casoPruebaId },
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

        // Validar script
        const validation = validateScript(caso.script, caso.scriptFileName ?? null)
        if (!validation.valid) {
          await db.ejecucion.update({
            where: { id: job.id },
            data: {
              estado: 'errorMotor',
              errorMsg: validation.error ?? 'Script inválido',
              finAt: new Date(),
            },
          })
          continue
        }

        // Escribir a archivo temporal
        const tmpPath = await writeTempScript(
          caso.script,
          caso.scriptFileName ?? 'test.spec.ts'
        )

        try {
          // Ejecutar
          const result = await runPlaywrightTest(tmpPath, job.id)

          // Determinar estado final basado en los pasos:
          // - Si hay algún paso con 'fallo' y sin selfHeal, el resultado es 'fallo'
          // - De lo contrario, es 'paso' (incluye casos con pasos 'reparado')
          const pasos = await db.pasoEjecucion.findMany({
            where: { ejecucionId: job.id },
          })

          const hasUnhealedFailure = pasos.some(
            (p) => p.estado === 'fallo' && !p.selfHealed
          )

          const finalEstado = hasUnhealedFailure ? 'fallo' : 'paso'

          await db.ejecucion.update({
            where: { id: job.id },
            data: {
              estado: finalEstado,
              finAt: new Date(),
              duracionMs: result.durationMs,
            },
          })
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e)
          await db.ejecucion.update({
            where: { id: job.id },
            data: {
              estado: 'errorMotor',
              errorMsg: message,
              finAt: new Date(),
            },
          })
        } finally {
          await cleanupTempScript(tmpPath)
        }
      }
    } catch (err) {
      console.error('[worker] Error:', err)
    }

    // Cleanup periódico (cada 10 iteraciones = 50s)
    await cleanupStaleScripts().catch(() => {})

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch(console.error)
