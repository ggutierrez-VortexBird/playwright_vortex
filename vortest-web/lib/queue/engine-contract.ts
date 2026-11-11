// Espejo manual del contrato de vortest-engine (execute-job.message.ts, events.publisher.ts); eventos validados con zod, esquemas permisivos a propósito.
import { z } from 'zod'

export interface ExecuteJobMessage {
  jobId: string
  scriptText: string
  scriptFileName: string
  inputStorageState?: unknown
  timeoutMs: number
  publishedAt: string
  navegador?: 'chromium' | 'firefox' | 'webkit'
}

/** `storageState` de Playwright; laxo: exige solo `cookies` y `origins` como arrays. */
export const StorageStateSchema = z.looseObject({
  cookies: z.array(z.unknown()),
  origins: z.array(z.unknown()),
})
export type StorageState = z.infer<typeof StorageStateSchema>

const LogLevelSchema = z.enum(['log', 'info', 'warn', 'error', 'debug'])
const LogSourceSchema = z.enum(['page', 'console', 'stderr', 'stdout'])
const EstadoPasoSchema = z.enum(['paso', 'fallo'])

export const LogEntrySchema = z.looseObject({
  ts: z.string(),
  level: LogLevelSchema,
  msg: z.string(),
  source: LogSourceSchema,
})
export type LogEntry = z.infer<typeof LogEntrySchema>

export const EnvEventPayloadSchema = z.looseObject({
  type: z.literal('env'),
  navegador: z.string(),
  sistemaOperativo: z.string(),
  nodoEjecucion: z.string(),
})
export type EnvEventPayload = z.infer<typeof EnvEventPayloadSchema>

export const StepEventPayloadSchema = z.looseObject({
  type: z.literal('step'),
  numero: z.number(),
  descripcion: z.string(),
  estado: EstadoPasoSchema,
  duracionMs: z.number(),
  errorMsg: z.string().nullish(),
  resultadoEsperado: z.string().nullish(),
  resultadoObtenido: z.string().nullish(),
  errorCount: z.number(),
  videoInicioMs: z.number().nullish(),
  videoFinMs: z.number().nullish(),
  logs: z.array(LogEntrySchema).nullish(),
})
export type StepEventPayload = z.infer<typeof StepEventPayloadSchema>

export const SubstepEventPayloadSchema = z.looseObject({
  type: z.literal('substep'),
  parentTestId: z.number(),
  numero: z.number(),
  tipo: z.enum(['assertion', 'action', 'setup', 'navigate', 'other']),
  descripcion: z.string(),
  estado: z.enum(['paso', 'fallo']),
  duracionMs: z.number(),
  errorMsg: z.string().nullish(),
  logs: z.array(LogEntrySchema).nullish(),
  capturaActualToken: z.string().nullish(),
  capturaReferenciaToken: z.string().nullish(),
})
export type SubstepEventPayload = z.infer<typeof SubstepEventPayloadSchema>

export const LogEventPayloadSchema = z.looseObject({
  type: z.literal('log'),
  parentTestId: z.number().nullish(),
  parentSubstepId: z.number().nullish(),
  ts: z.string(),
  level: LogLevelSchema,
  msg: z.string(),
  source: LogSourceSchema,
})
export type LogEventPayload = z.infer<typeof LogEventPayloadSchema>

export const AssertionEventPayloadSchema = z.looseObject({
  type: z.literal('assertion'),
  parentTestId: z.number(),
  descripcion: z.string(),
  ok: z.boolean(),
})
export type AssertionEventPayload = z.infer<typeof AssertionEventPayloadSchema>

export const CapturaTestEventPayloadSchema = z.looseObject({
  type: z.literal('captura-test'),
  parentTestId: z.number(),
  capturaActualToken: z.string().nullish(),
  capturaReferenciaToken: z.string().nullish(),
  /** Referencia directa al subpaso (opcional: motores viejos no la envían). */
  substepNumero: z.number().nullish(),
})
export type CapturaTestEventPayload = z.infer<typeof CapturaTestEventPayloadSchema>

export const CollectedArtifactRefSchema = z.looseObject({
  fileName: z.string(),
  artefactoId: z.string(),
  tipo: z.enum(['video', 'captura', 'trace']),
  pasoNumero: z.number().nullish(),
  phase: z.enum(['captura-actual', 'captura-referencia']).nullish(),
})
export type CollectedArtifactRef = z.infer<typeof CollectedArtifactRefSchema>

export const EndEventPayloadSchema = z.looseObject({
  type: z.literal('end'),
  estado: z.enum(['paso', 'fallo', 'errorMotor']),
  duracionMs: z.number(),
  asercionesTotal: z.number(),
  asercionesOk: z.number(),
  asercionesFail: z.number(),
  // Se valida aparte con StorageStateSchema; acá solo se deja pasar.
  outputStorageState: z.unknown().optional(),
  errorMsg: z.string().nullish(),
  artifactUploadFailed: z.boolean().optional(),
  artefactos: z.array(CollectedArtifactRefSchema).optional(),
})
export type EndEventPayload = z.infer<typeof EndEventPayloadSchema>

export const EngineEventPayloadSchema = z.discriminatedUnion('type', [
  EnvEventPayloadSchema,
  StepEventPayloadSchema,
  SubstepEventPayloadSchema,
  LogEventPayloadSchema,
  AssertionEventPayloadSchema,
  CapturaTestEventPayloadSchema,
  EndEventPayloadSchema,
])
export type EngineEventPayload = z.infer<typeof EngineEventPayloadSchema>

/** Envoltorio `EngineEvent` validado (payload = unión discriminada). */
export const EngineEventSchema = z.looseObject({
  jobId: z.string(),
  seq: z.number(),
  emittedAt: z.string(),
  payload: EngineEventPayloadSchema,
})

export interface EngineEvent<T extends EngineEventPayload = EngineEventPayload> {
  jobId: string
  seq: number
  emittedAt: string
  payload: T
}
