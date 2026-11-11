// Publica en engine.events los eventos del reporter dentro de un sobre EngineEvent (jobId/seq/emittedAt)

import { Inject, Injectable, Logger } from '@nestjs/common'
import type { ClientProxy } from '@nestjs/microservices'
import type { LogEntry } from '../execution/log-cap'

export const ENGINE_EVENTS_CLIENT = 'ENGINE_EVENTS_CLIENT'
export const ENGINE_EVENTS_QUEUE = 'engine.events'

// Payloads por tipo de evento

export interface EnvEventPayload {
  type: 'env'
  navegador: string
  sistemaOperativo: string
  nodoEjecucion: string
}

export interface StepEventPayload {
  type: 'step'
  numero: number
  descripcion: string
  estado: 'paso' | 'fallo'
  duracionMs: number
  errorMsg: string | null
  resultadoEsperado: string | null
  resultadoObtenido: string | null
  errorCount: number
  /** Offset en ms desde el inicio del video */
  videoInicioMs: number | null
  videoFinMs: number | null
  /** Logs acumulados (page/console/stderr/stdout) durante este paso. */
  logs: LogEntry[] | null
}

export interface SubstepEventPayload {
  type: 'substep'
  parentTestId: number
  numero: number
  tipo: 'assertion' | 'action' | 'setup' | 'navigate' | 'other'
  descripcion: string
  estado: 'paso' | 'fallo'
  duracionMs: number
  errorMsg: string | null
  logs: LogEntry[] | null
  /** Token = artefactoId devuelto por la subida HTTP. Null si no hay captura. */
  capturaActualToken: string | null
  capturaReferenciaToken: string | null
}

export interface LogEventPayload {
  type: 'log'
  parentTestId: number | null
  parentSubstepId: number | null
  ts: string
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  msg: string
  source: 'page' | 'console' | 'stderr' | 'stdout'
}

export interface AssertionEventPayload {
  type: 'assertion'
  parentTestId: number
  descripcion: string
  ok: boolean
}

export interface CapturaTestEventPayload {
  type: 'captura-test'
  parentTestId: number
  substepNumero: number | null
  capturaActualToken: string | null
  capturaReferenciaToken: string | null
}

/** Un artefacto detectado en el barrido post-ejecución (artifacts.service.ts). */
export interface CollectedArtifactRef {
  fileName: string
  artefactoId: string
  tipo: 'video' | 'captura' | 'trace'
  /** Número de PasoEjecucion al que la heurística de nombre lo asocia, si aplica. */
  pasoNumero?: number | null
  /** Fase detectada (toHaveScreenshot naming), si aplica. */
  phase?: 'captura-actual' | 'captura-referencia' | null
}

export interface EndEventPayload {
  type: 'end'
  estado: 'paso' | 'fallo' | 'errorMotor'
  duracionMs: number
  asercionesTotal: number
  asercionesOk: number
  asercionesFail: number
  /** storageState resultante, para encadenamiento padre/hijo. */
  outputStorageState?: unknown
  /** Mensaje de error cuando estado === 'errorMotor'; lo agrega el motor, no el reporter */
  errorMsg?: string | null
  /** Algún artefacto no pudo subirse tras agotar reintentos */
  artifactUploadFailed?: boolean
  /** Artefactos detectados en el barrido post-ejecución (video, capturas sueltas). */
  artefactos?: CollectedArtifactRef[]
}

export type EngineEventPayload =
  | EnvEventPayload
  | StepEventPayload
  | SubstepEventPayload
  | LogEventPayload
  | AssertionEventPayload
  | CapturaTestEventPayload
  | EndEventPayload

export interface EngineEvent<T extends EngineEventPayload = EngineEventPayload> {
  jobId: string
  /** Detecta huecos/reordenamiento en el consumidor. */
  seq: number
  emittedAt: string
  payload: T
}

@Injectable()
export class EventsPublisherService {
  private readonly logger = new Logger(EventsPublisherService.name)
  private readonly seqByJob = new Map<string, number>()

  constructor(@Inject(ENGINE_EVENTS_CLIENT) private readonly client: ClientProxy) {}

  private nextSeq(jobId: string): number {
    const next = (this.seqByJob.get(jobId) ?? 0) + 1
    this.seqByJob.set(jobId, next)
    return next
  }

  /** Libera el contador de seq de un job — llamar cuando el job termina. */
  releaseJob(jobId: string): void {
    this.seqByJob.delete(jobId)
  }

  private emit<T extends EngineEventPayload>(jobId: string, payload: T): void {
    const event: EngineEvent<T> = {
      jobId,
      seq: this.nextSeq(jobId),
      emittedAt: new Date().toISOString(),
      payload,
    }
    // Fire-and-forget: los errores de conexión se loggean sin tumbar la ejecución
    try {
      this.client.emit(ENGINE_EVENTS_QUEUE, event).subscribe({
        error: (err: unknown) =>
          this.logger.error(
            `Error publicando evento ${payload.type} para job ${jobId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
      })
    } catch (err) {
      this.logger.error(
        `Excepción síncrona publicando evento ${payload.type} para job ${jobId}`,
        err instanceof Error ? err.stack : String(err),
      )
    }
  }

  emitEnv(jobId: string, payload: Omit<EnvEventPayload, 'type'>): void {
    this.emit(jobId, { type: 'env', ...payload })
  }

  emitStep(jobId: string, payload: Omit<StepEventPayload, 'type'>): void {
    this.emit(jobId, { type: 'step', ...payload })
  }

  emitSubstep(jobId: string, payload: Omit<SubstepEventPayload, 'type'>): void {
    this.emit(jobId, { type: 'substep', ...payload })
  }

  emitLog(jobId: string, payload: Omit<LogEventPayload, 'type'>): void {
    this.emit(jobId, { type: 'log', ...payload })
  }

  emitAssertion(jobId: string, payload: Omit<AssertionEventPayload, 'type'>): void {
    this.emit(jobId, { type: 'assertion', ...payload })
  }

  emitCapturaTest(jobId: string, payload: Omit<CapturaTestEventPayload, 'type'>): void {
    this.emit(jobId, { type: 'captura-test', ...payload })
  }

  emitEnd(jobId: string, payload: Omit<EndEventPayload, 'type'>): void {
    this.emit(jobId, { type: 'end', ...payload })
    this.releaseJob(jobId)
  }
}
