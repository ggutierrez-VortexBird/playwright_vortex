// Worker de larga duración — corre en node scripts/worker.ts
import { db } from '../lib/db'
import {
  writeTempScript,
  cleanupTempScript,
  cleanupStaleScripts,
} from '../lib/worker/script-temp'
import { validateScript } from '../lib/worker/validate-script'
import { runPlaywrightTest, EjecucionCanceladaError } from '../lib/worker/runner'
import { collectArtifacts } from '../lib/worker/artifacts'
import { tryClaimPendingExecution } from '../lib/worker/claim'

const POLL_INTERVAL_MS = 5000

async function main() {
  console.log('[worker] Arrancado, esperando ejecuciones pendientes...')

  // Cleanup inicial de scripts huérfanos
  await cleanupStaleScripts()

  while (true) {
    try {
      // Atomic claim: si la ejecución fue cancelada entre findFirst y updateMany,
      // tryClaimPendingExecution retorna null y seguimos al próximo poll.
      const job = await tryClaimPendingExecution(db)

      if (job) {
        console.log(`[worker] Procesando ejecución ${job.id}`)

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
          // Ejecutar — pasamos `isAborted` para que el runner pueda
          // detectar cancelación del usuario durante la corrida.
          const result = await runPlaywrightTest(
            tmpPath,
            job.id,
            async () => {
              const current = await db.ejecucion.findUnique({
                where: { id: job.id },
                select: { estado: true },
              })
              return current?.estado === 'cancelado'
            }
          )

          // Determinar estado final basado en los pasos:
          // - Si hay algún paso con 'fallo' y sin selfHeal, el resultado es 'fallo'
          // - De lo contrario, es 'paso' (incluye casos con pasos 'reparado')
          const pasos = await db.pasoEjecucion.findMany({
            where: { ejecucionId: job.id },
          })

          // HU-FIX: si no hay pasos, el test no ejecutó realmente (script vacío,
          // error silencioso, o reporter no funcionó). No debe marcar como 'paso'.
          if (pasos.length === 0) {
            console.error(`[worker] Ejecución ${job.id} terminó sin pasos — posible script vacío o error silencioso`)
            await db.ejecucion.update({
              where: { id: job.id },
              data: {
                estado: 'errorMotor',
                errorMsg: 'La ejecución no generó pasos. Posibles causas: script vacío, error de sintaxis no reportado, o falla del reporter.',
                finAt: new Date(),
                duracionMs: result.durationMs,
              },
            })
            continue
          }

          const hasUnhealedFailure = pasos.some(
            (p) => p.estado === 'fallo' && !p.selfHealed
          )

          // Recolectar artefactos (video/capturas) generados por Playwright
          try {
            await collectArtifacts(job.id, result.outputDir)
          } catch (collectErr) {
            console.error(`[worker] Error recolectando artefactos para ${job.id}:`, collectErr)
          }

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
          // Si fue cancelada por el usuario, el estado ya es 'cancelado' en BD
          // (puesto por detenerEjecucion). Solo aseguramos finAt.
          if (e instanceof EjecucionCanceladaError) {
            await db.ejecucion.update({
              where: { id: job.id },
              data: { finAt: new Date() },
            })
            console.log(`[worker] Ejecución ${job.id} cancelada por el usuario`)
            continue
          }
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
