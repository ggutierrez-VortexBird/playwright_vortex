// src/execution/execution.service.ts
// Orquesta un job de principio a fin — equivalente a la combinación de
// vortest-web/lib/worker/execute-case.ts + scripts/worker.ts, pero SIN
// conocimiento de Prisma/DB/"casos". Recibe un ExecuteJobMessage ya
// templado por vortest-web, escribe el script a disco, corre el runner
// portado, sube artefactos, y emite el evento `end` final.
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ArtifactsService } from '../artifacts/artifacts.service'
import type { CollectedArtifactRef } from '../queue/events.publisher'
import { EventsPublisherService } from '../queue/events.publisher'
import type { ExecuteJobMessage } from '../queue/execute-job.message'
import { ActiveJobsRegistry } from './active-jobs.registry'
import { getJobOutputDir, EjecucionCanceladaError, runPlaywrightTest } from './runner'
import { cleanupTempScript, writeTempScript } from './script-writer'
import * as path from 'path'
import { promises as fs } from 'fs'

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name)

  constructor(
    private readonly eventsPublisher: EventsPublisherService,
    private readonly artifactsService: ArtifactsService,
    private readonly registry: ActiveJobsRegistry,
    config: ConfigService,
  ) {
    this.maxConcurrentes = config.get<number>('ENGINE_MAX_CONCURRENT_JOBS', 3)
  }

  // El job se confirma a RabbitMQ al arrancar, así que el prefetch no limita cuántos navegadores corren a la vez: lo limita este semáforo.
  private readonly maxConcurrentes: number
  private enCurso = 0
  private readonly turnos: Array<() => void> = []

  private async tomarTurno(): Promise<void> {
    if (this.enCurso < this.maxConcurrentes) {
      this.enCurso++
      return
    }
    await new Promise<void>((resolve) => this.turnos.push(resolve))
  }

  private liberarTurno(): void {
    const siguiente = this.turnos.shift()
    if (siguiente) siguiente()
    else this.enCurso--
  }

  /**
   * Resuelve tan pronto el job queda REGISTRADO en ActiveJobsRegistry — es
   * decir, apenas se spawneó el proceso de Playwright — NO cuando el job
   * termina. `ExecuteJobConsumer` espera esta promesa y solo entonces hace
   * ack del mensaje de RabbitMQ (ver comentario de ack manual ahí), acotando
   * la ventana de redelivery a "crasheó antes de arrancar" en vez de
   * "crasheó en cualquier punto de la corrida" (riesgo aceptado y ya
   * documentado en la arquitectura, no resuelto del todo acá a propósito).
   *
   * El resto de la ejecución (correr Playwright, subir artefactos, emitir
   * el evento `end`) sigue en segundo plano después de que esta promesa
   * resuelve — no se espera desde acá.
   */
  async runJob(job: ExecuteJobMessage): Promise<void> {
    if (this.registry.has(job.jobId) || this.registry.estaEnEspera(job.jobId)) {
      this.logger.warn(`Job ${job.jobId} ya está activo en esta instancia — ignorando entrega duplicada`)
      return
    }

    this.registry.entrarEnEspera(job.jobId)
    await this.tomarTurno()
    if (this.registry.salirDeEspera(job.jobId)) {
      this.liberarTurno()
      this.logger.log(`Job ${job.jobId} cancelado mientras esperaba turno — no se ejecuta`)
      return
    }

    return new Promise<void>((resolveRegistered, rejectRegistered) => {
      let registered = false
      this.executeInternal(job, () => {
        registered = true
        resolveRegistered()
      }).finally(() => this.liberarTurno()).catch((err: unknown) => {
        if (!registered) {
          rejectRegistered(err instanceof Error ? err : new Error(String(err)))
        }
        // Si ya estaba registrado, el error ya fue manejado (evento `end`
        // emitido) dentro de executeInternal — acá no hay nada más que hacer
        // salvo evitar un unhandled rejection.
      })
    })
  }

  private async executeInternal(job: ExecuteJobMessage, onRegistered: () => void): Promise<void> {
    const startedAt = Date.now()
    let scriptPath: string | undefined
    let registered = false

    try {
      scriptPath = await writeTempScript(job.scriptText, job.scriptFileName)

      const abortController = new AbortController()
      const runResult = await runPlaywrightTest(
        scriptPath,
        job.jobId,
        { eventsPublisher: this.eventsPublisher, artifactsService: this.artifactsService },
        {
          abortSignal: abortController.signal,
          inputStorageState: job.inputStorageState,
          timeoutMs: job.timeoutMs,
          projectName: job.navegador,
          onSpawn: (proc) => {
            this.registry.register(job.jobId, { proc, abortController })
            registered = true
            onRegistered()
          },
        },
      )

      const { artefactos, anyFailed } = await this.artifactsService
        .collectAndUploadArtifacts(job.jobId, runResult.outputDir, runResult.pasoNumero)
        .catch((err: unknown) => {
          this.logger.error(
            `Error recolectando artefactos para job ${job.jobId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          )
          return { artefactos: [] as CollectedArtifactRef[], anyFailed: true }
        })

      // HU-FIX (preservado): si no hay pasos, el test no ejecutó realmente
      // (script vacío, error silencioso, o el reporter no corrió). No debe
      // reportarse como 'paso'. Reemplaza la consulta
      // `prisma.pasoEjecucion.findMany` de execute-case.ts original por el
      // conteo en memoria que el runner ya trackea.
      let estado: 'paso' | 'fallo' | 'errorMotor'
      let errorMsg: string | null = null
      if (runResult.pasoNumero === 0) {
        estado = 'errorMotor'
        errorMsg =
          'La ejecución no generó pasos. Posibles causas: script vacío, error de sintaxis no reportado, o falla del reporter.'
        this.logger.error(`Job ${job.jobId} terminó sin pasos`)
      } else {
        estado = runResult.passed ? 'paso' : 'fallo'
      }

      this.eventsPublisher.emitEnd(job.jobId, {
        estado,
        duracionMs: runResult.durationMs,
        asercionesTotal: runResult.asercionesTotal,
        asercionesOk: runResult.asercionesOk,
        asercionesFail: runResult.asercionesFail,
        outputStorageState: runResult.outputStorageState,
        errorMsg,
        artifactUploadFailed: runResult.artifactUploadFailed || anyFailed,
        artefactos,
      })
    } catch (err) {
      if (err instanceof EjecucionCanceladaError) {
        // FIA-16: si el proceso ya terminó con resultado real (code 0/1 + estado
        // paso/fallo del reporter) cuando llegó la cancelación,emitimos el 'end'
        // con ese resultado — vortest-web descarta si la fila ya está 'cancelado'.
        // Si todavía estaba corriendo sin resultado, no se emite 'end'.
        this.logger.log(
          `Job ${job.jobId} cancelado por el usuario — no se emite evento 'end' (vortest-web ya marcó ` +
            `'cancelado' de forma optimista en detenerEjecucion, el motor no necesita reportarlo de vuelta)`,
        )
        return
      }

      const message = err instanceof Error ? err.message : String(err)
      this.logger.error(`Job ${job.jobId} falló: ${message}`)

      // Solo emitimos un evento `end` de error si el job llegó a arrancar
      // (registrado). Si falló ANTES de eso (p.ej. writeTempScript), el
      // mensaje de RabbitMQ nunca se ackeó — será redistribuido y esta
      // corrida no debe reportar un resultado final que compita con el
      // reintento.
      if (registered) {
        this.eventsPublisher.emitEnd(job.jobId, {
          estado: 'errorMotor',
          duracionMs: Date.now() - startedAt,
          asercionesTotal: 0,
          asercionesOk: 0,
          asercionesFail: 0,
          errorMsg: message,
        })
      }

      throw err
    } finally {
      this.registry.unregister(job.jobId)
      if (scriptPath) await cleanupTempScript(scriptPath)
      // FIA-05: limpiar directorio de output del job.
      const outputDir = getJobOutputDir(job.jobId)
      // Reintentos: al cancelar, Playwright recién matado aún cierra el video y el primer rm falla con ENOTEMPTY.
      await fs.rm(outputDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch((e: unknown) =>
        this.logger.warn(`[${job.jobId}] No se pudo limpiar outputDir: ${e instanceof Error ? e.message : String(e)}`),
      )
      // Al cancelar, el worker de Playwright sobrevive ~1 s al proceso matado y vuelve a escribir trace/error-context: segunda pasada diferida.
      setTimeout(() => void fs.rm(outputDir, { recursive: true, force: true }).catch(() => undefined), 5000).unref()
    }
  }
}
