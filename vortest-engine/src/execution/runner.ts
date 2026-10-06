// src/execution/runner.ts
// Port near-1:1 de vortest-web/lib/worker/runner.ts — mismo spawn de
// `playwright test` como child process, mismo parseo NDJSON línea-por-línea
// desde stdout, mismo timeout global (ahora configurable vía job.timeoutMs
// en vez de hardcodeado a 10 min), mismo soporte de abort/cancelación
// (ahora vía AbortSignal disparado por el controller HTTP en vez de un
// polling `isAborted()` contra la DB — la cancelación ahora es push, no
// poll, porque ya no hay una fila `Ejecucion.estado` local que consultar).
//
// Cada `prisma.*` de los handlers de evento del original se reemplaza acá
// por una llamada a `EventsPublisherService` (publicar el evento) y, para
// capturas, una subida previa vía `ArtifactsService` (el motor sube el
// artefacto ANTES de emitir el evento que lo referencia, devolviendo un
// Token = artefactoId en vez de un path local).
import { Logger } from '@nestjs/common'
import { spawn, type ChildProcess } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'
import { killProcessTree } from './kill-tree'
import { capLogs, type LogEntry } from './log-cap'
import { writeStorageState, readStorageState, cleanupStorageState } from './storage-state'
import type { EventsPublisherService } from '../queue/events.publisher'
import type { ArtifactsService } from '../artifacts/artifacts.service'

const logger = new Logger('Runner')

/**
 * Prefijo centinela (PW-08): el reporter antepone esto a cada línea JSON que
 * emite. Cualquier línea de stdout sin el prefijo (salida de un test, de una
 * librería, de un `console.log` del usuario) se ignora en vez de
 * interpretarse como evento, evitando que un script pueda falsear eventos
 * con un JSON que casualmente tenga `type: 'step'`, etc.
 */
export const REPORTER_LINE_PREFIX = '__VORTEST__'

/** Ruta del directorio de salida de un job — única fuente de verdad (runner + limpieza). */
export function getJobOutputDir(jobId: string): string {
  return path.resolve(process.cwd(), 'runtime', 'ejecuciones', 'output', jobId)
}

// ============================================================
// Tipos de evento emitidos por scripts/my-reporter.js (formato de cable
// entre el subproceso de Playwright y este runner — NO confundir con el
// EngineEvent que sale hacia RabbitMQ, definido en queue/events.publisher.ts).
// Idénticos a los de vortest-web/lib/worker/runner.ts.
// ============================================================

export interface EnvEvent {
  type: 'env'
  navegador: string
  sistemaOperativo: string
  nodoEjecucion: string
}

export interface StepEvent {
  type: 'step'
  numero: number
  descripcion: string
  estado: 'paso' | 'fallo' | 'passed' | 'failed' | 'skipped'
  duracionMs: number
  errorMsg?: string | null
  resultadoEsperado?: string | null
  resultadoObtenido?: string | null
  errorCount?: number
  videoInicioMs?: number
  videoFinMs?: number
}

export interface SubstepEvent {
  type: 'substep'
  parentTestId: number
  numero: number
  tipo: 'assertion' | 'action' | 'setup' | 'navigate' | 'other'
  descripcion: string
  estado: 'paso' | 'fallo'
  duracionMs: number
  errorMsg?: string | null
  capturaActualPath?: string | null
  capturaReferenciaPath?: string | null
}

export interface LogEvent {
  type: 'log'
  parentTestId: number | null
  parentSubstepId: number | null
  ts: string
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  msg: string
  source: 'page' | 'console' | 'stderr' | 'stdout'
}

export interface AssertionEvent {
  type: 'assertion'
  parentTestId: number
  descripcion: string
  ok: boolean
}

export interface CapturaTestEvent {
  type: 'captura-test'
  parentTestId: number
  capturaActualPath: string | null
  capturaReferenciaPath: string | null
  /** Número del último subpaso del test al momento de la captura (FIA-11). Opcional. */
  substepNumero?: number | null
}

export interface EndEvent {
  type: 'end'
  estado: 'paso' | 'fallo' | 'reparado' | 'errorMotor'
  duracionMs: number
  asercionesTotal: number
  asercionesOk: number
  asercionesFail: number
}

export type ReporterEvent =
  | EnvEvent
  | StepEvent
  | SubstepEvent
  | LogEvent
  | AssertionEvent
  | CapturaTestEvent
  | EndEvent

const VALID_TYPES = new Set([
  'env',
  'step',
  'substep',
  'log',
  'assertion',
  'captura-test',
  'end',
])

export function parseReporterEvent(line: string): ReporterEvent | null {
  if (!line.startsWith(REPORTER_LINE_PREFIX)) return null
  try {
    const parsed = JSON.parse(line.slice(REPORTER_LINE_PREFIX.length)) as Record<string, unknown>
    if (!parsed.type || typeof parsed.type !== 'string') return null
    if (!VALID_TYPES.has(parsed.type)) return null
    return parsed as unknown as ReporterEvent
  } catch {
    return null
  }
}

/**
 * Error lanzado cuando el runner detecta una cancelación disparada por
 * POST /internal/cancel/:jobId (ver InternalHttpController). El caller
 * (ExecutionService) la captura y NO emite un evento `end` — el estado
 * `cancelado` ya vive en vortest-web de forma optimista (detenerEjecucion),
 * el motor no necesita reportarlo de vuelta.
 */
export class EjecucionCanceladaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EjecucionCanceladaError'
  }
}

// ============================================================
// RunnerState — estado mutable acumulado durante una sola corrida.
// ============================================================

interface RunnerState {
  jobId: string
  pasoNumero: number
  substepCounters: Map<number, number>
  logBuffers: Map<number, LogEntry[]>
  substepLogBuffers: Map<string, LogEntry[]>
  assertionCounters: { total: number; ok: number; fail: number }
  envCaptured: boolean
  /** Promesas de trabajo en vuelo (uploads de artefactos + emit) a esperar antes de resolver. */
  pendingEmits: Promise<unknown>[]
  /** true si algún upload de artefacto agotó reintentos sin éxito. */
  artifactUploadFailed: boolean
  /** Estado del evento `end` del reporter, si llegó (FIA-16: distingue resultado real de proceso interrumpido). */
  reporterEndEstado: EndEvent['estado'] | null
}

function createRunnerState(jobId: string): RunnerState {
  return {
    jobId,
    pasoNumero: 0,
    substepCounters: new Map(),
    logBuffers: new Map(),
    substepLogBuffers: new Map(),
    assertionCounters: { total: 0, ok: 0, fail: 0 },
    envCaptured: false,
    pendingEmits: [],
    artifactUploadFailed: false,
    reporterEndEstado: null,
  }
}

export interface RunnerDeps {
  eventsPublisher: Pick<
    EventsPublisherService,
    'emitEnv' | 'emitStep' | 'emitSubstep' | 'emitLog' | 'emitAssertion' | 'emitCapturaTest'
  >
  artifactsService: Pick<ArtifactsService, 'uploadArtifact'>
}

// ============================================================
// Event handlers — mismo dispatch por tipo que el original; cada
// `prisma.*` se reemplaza por `eventsPublisher.emit*` (+ upload previo de
// artefactos referenciados).
// ============================================================

function handleEnvEvent(state: RunnerState, event: EnvEvent, deps: RunnerDeps): void {
  if (state.envCaptured) return
  state.envCaptured = true
  deps.eventsPublisher.emitEnv(state.jobId, {
    navegador: event.navegador,
    sistemaOperativo: event.sistemaOperativo,
    nodoEjecucion: event.nodoEjecucion,
  })
}

function normalizeStepEstado(raw: StepEvent['estado']): 'paso' | 'fallo' {
  if (raw === 'passed' || raw === 'paso') return 'paso'
  if (raw === 'failed' || raw === 'fallo') return 'fallo'
  if (raw === 'skipped') return 'paso'
  return 'fallo'
}

function handleStepEvent(state: RunnerState, event: StepEvent, deps: RunnerDeps): void {
  state.pasoNumero++
  const numero = state.pasoNumero
  const estado = normalizeStepEstado(event.estado)

  const logs = state.logBuffers.get(numero) ?? null

  deps.eventsPublisher.emitStep(state.jobId, {
    numero,
    descripcion: event.descripcion,
    estado,
    duracionMs: event.duracionMs,
    errorMsg: event.errorMsg ?? null,
    resultadoEsperado: event.resultadoEsperado ?? null,
    resultadoObtenido: event.resultadoObtenido ?? null,
    errorCount: event.errorCount ?? 0,
    videoInicioMs: event.videoInicioMs ?? null,
    videoFinMs: event.videoFinMs ?? null,
    logs,
  })
}

/**
 * Sube una captura referenciada por un evento (si hay path) y retorna su
 * Token (artefactoId). Reemplaza a `ensureArtefacto` del original — ya no
 * hay DB para deduplicar por sha256+ejecucionId, eso lo hace ahora el
 * endpoint de subida en vortest-web (ver ArtifactsService.uploadArtifact).
 */
async function uploadCaptureIfPresent(
  state: RunnerState,
  deps: RunnerDeps,
  filePath: string | null | undefined,
): Promise<string | null> {
  if (!filePath) return null
  if (!fs.existsSync(filePath)) {
    logger.warn(`[${state.jobId}] Capture file not found: ${filePath}`)
    return null
  }
  const result = await deps.artifactsService
    .uploadArtifact({
      jobId: state.jobId,
      filePath,
      fileName: path.basename(filePath),
      tipo: 'captura',
    })
    .catch((err: unknown) => {
      logger.error(
        `[${state.jobId}] Error uploading capture ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return null
    })
  if (!result) {
    state.artifactUploadFailed = true
    return null
  }
  return result.artefactoId
}

function handleSubstepEvent(state: RunnerState, event: SubstepEvent, deps: RunnerDeps): Promise<void> {
  const parentNumero = event.parentTestId
  const prev = state.substepCounters.get(parentNumero) ?? 0
  const numero = prev + 1
  state.substepCounters.set(parentNumero, numero)

  const logs = state.substepLogBuffers.get(`${parentNumero}:${numero}`) ?? null

  return Promise.all([
    uploadCaptureIfPresent(state, deps, event.capturaActualPath),
    uploadCaptureIfPresent(state, deps, event.capturaReferenciaPath),
  ]).then(([capturaActualToken, capturaReferenciaToken]) => {
    deps.eventsPublisher.emitSubstep(state.jobId, {
      parentTestId: parentNumero,
      numero,
      tipo: event.tipo,
      descripcion: event.descripcion,
      estado: event.estado,
      duracionMs: event.duracionMs,
      errorMsg: event.errorMsg ?? null,
      logs,
      capturaActualToken,
      capturaReferenciaToken,
    })
  })
}

function handleLogEvent(state: RunnerState, event: LogEvent, deps: RunnerDeps): void {
  const entry: LogEntry = {
    ts: event.ts,
    level: event.level,
    msg: event.msg,
    source: event.source,
  }

  if (event.parentSubstepId !== null && event.parentTestId !== null) {
    const key = `${event.parentTestId}:${event.parentSubstepId}`
    const current = state.substepLogBuffers.get(key)
    state.substepLogBuffers.set(key, capLogs(current, entry, 100))
  } else if (event.parentTestId !== null) {
    const current = state.logBuffers.get(event.parentTestId)
    state.logBuffers.set(event.parentTestId, capLogs(current, entry, 200))
  }

  // Relay en vivo — el canal engine.events reemplaza por completo la lectura
  // local de stdout que hacía el worker viejo, así que cualquier tipo de
  // evento que el reporter emitía debe seguir llegando al otro lado.
  deps.eventsPublisher.emitLog(state.jobId, {
    parentTestId: event.parentTestId,
    parentSubstepId: event.parentSubstepId,
    ts: event.ts,
    level: event.level,
    msg: event.msg,
    source: event.source,
  })
}

function handleAssertionEvent(state: RunnerState, event: AssertionEvent, deps: RunnerDeps): void {
  state.assertionCounters.total++
  if (event.ok) {
    state.assertionCounters.ok++
  } else {
    state.assertionCounters.fail++
  }

  deps.eventsPublisher.emitAssertion(state.jobId, {
    parentTestId: event.parentTestId,
    descripcion: event.descripcion,
    ok: event.ok,
  })
}

function handleCapturaTestEvent(state: RunnerState, event: CapturaTestEvent, deps: RunnerDeps): Promise<void> {
  return Promise.all([
    uploadCaptureIfPresent(state, deps, event.capturaActualPath),
    uploadCaptureIfPresent(state, deps, event.capturaReferenciaPath),
  ]).then(([capturaActualToken, capturaReferenciaToken]) => {
    deps.eventsPublisher.emitCapturaTest(state.jobId, {
      parentTestId: event.parentTestId,
      substepNumero: event.substepNumero ?? null,
      capturaActualToken,
      capturaReferenciaToken,
    })
  })
}

function handleEndEvent(state: RunnerState, event: EndEvent): void {
  state.reporterEndEstado = event.estado
  // El 'end' del reporter (NDJSON) solo alimenta los contadores de
  // aserciones si el reporter los reportó — el EngineEvent 'end' real hacia
  // engine.events lo emite ExecutionService DESPUÉS de que el proceso cierra
  // y se leyó el storageState resultante (ver execution.service.ts), igual
  // que el original: handleEndEvent (mid-stream) solo actualizaba
  // contadores; persistExecutionResult (post-proceso) hacía el resto.
  if (event.asercionesTotal > 0) {
    state.assertionCounters.total = event.asercionesTotal
    state.assertionCounters.ok = event.asercionesOk
    state.assertionCounters.fail = event.asercionesFail
  }
}

// ============================================================
// Main runner
// ============================================================

const STDERR_TAIL_BYTES = 2048

export interface RunPlaywrightOptions {
  /** Disparada por InternalHttpController al cancelar el job. */
  abortSignal?: AbortSignal
  inputStorageState?: unknown
  /** Reemplaza al 10 min hardcodeado del original — viene del job message. */
  timeoutMs: number
  /** Nombre del proyecto Playwright (chromium | firefox | webkit). */
  projectName?: string
  /**
   * Llamado apenas se spawnea el proceso — usado por ExecutionService para
   * registrar {proc, abortController} en ActiveJobsRegistry ANTES de ackear
   * el mensaje de RabbitMQ (ver el comentario de ack manual en
   * execute-job.consumer.ts).
   */
  onSpawn?: (proc: ChildProcess) => void
}

export interface RunPlaywrightResult {
  passed: boolean
  durationMs: number
  outputDir: string
  outputStorageState?: unknown
  pasoNumero: number
  asercionesTotal: number
  asercionesOk: number
  asercionesFail: number
  artifactUploadFailed: boolean
}

// El script del caso lo escribe un usuario: sólo recibe lo que Playwright y el sistema necesitan, nunca RABBITMQ_URL ni ENGINE_INTERNAL_SECRET.
const VARIABLES_DEL_SCRIPT = new Set([
  'PATH', 'PATHEXT', 'HOME', 'USERPROFILE', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'TZ', 'NODE_ENV',
  'SystemRoot', 'SYSTEMROOT', 'ComSpec', 'COMSPEC', 'APPDATA', 'LOCALAPPDATA', 'DISPLAY', 'XDG_RUNTIME_DIR',
])

export function entornoDelScript(origen: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(origen).filter(([clave]) => VARIABLES_DEL_SCRIPT.has(clave) || clave.startsWith('PLAYWRIGHT_') || clave.startsWith('PW_')),
  )
}

export async function runPlaywrightTest(
  scriptPath: string,
  jobId: string,
  deps: RunnerDeps,
  options: RunPlaywrightOptions,
): Promise<RunPlaywrightResult> {
  const { abortSignal, inputStorageState, timeoutMs, projectName, onSpawn } = options
  const outputDir = getJobOutputDir(jobId)
  fs.mkdirSync(outputDir, { recursive: true })

  // HU-PARENT: escribir el storageState del caso padre a disco para que
  // playwright.config.ts lo cargue; después de la ejecución leeremos el
  // storageState resultante (afterEach lo persiste).
  const storageStatePath = path.resolve(process.cwd(), 'runtime', 'storage-state', `${jobId}.json`)
  if (inputStorageState !== undefined) {
    writeStorageState(jobId, inputStorageState)
  } else {
    cleanupStorageState(jobId)
  }

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const state = createRunnerState(jobId)
    let settled = false

    const configPath = path.resolve(process.cwd(), 'playwright.config.ts')
    const scriptName = path.basename(scriptPath)

    const cliPath = path.resolve(process.cwd(), 'node_modules', '@playwright', 'test', 'cli.js')

    const env: NodeJS.ProcessEnv = {
      ...entornoDelScript(process.env),
      FORCE_COLOR: '0',
      VORTEST_RUNNER: '1',
      VORTEST_OUTPUT_DIR: outputDir,
      PLAYWRIGHT_STORAGE_STATE_OUTPUT: storageStatePath,
    }
    if (inputStorageState !== undefined) {
      env.PLAYWRIGHT_STORAGE_STATE = storageStatePath
    }

    // PW-01: el timeout por test de Playwright se alinea con el presupuesto
    // del job (menos 60 s de margen para que Playwright falle limpio antes de
    // que el watchdog global de abajo mate el árbol de procesos).
    const perTestTimeoutMs = Math.max(30_000, timeoutMs - 60_000)

    const proc = spawn(
      'node',
      [
        cliPath,
        'test',
        scriptName,
        `--config=${configPath}`,
        `--output=${outputDir}`,
        `--timeout=${perTestTimeoutMs}`,
        ...(projectName ? ['--project', projectName] : []),
      ],
      {
        cwd: path.resolve(process.cwd(), 'runtime', 'ejecuciones'),
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      },
    )
    onSpawn?.(proc)

    let stdout = ''
    // FIA-18: solo se conserva la cola de stderr (se usa slice(-200) al fallar).
    let stderr = ''
    let aborted = false
    let processExited = false
    const eventCounts = { env: 0, step: 0, substep: 0, log: 0, assertion: 0, 'captura-test': 0, end: 0 }

    let globalTimeoutId: NodeJS.Timeout | null = null

    function cleanup() {
      if (globalTimeoutId) {
        clearTimeout(globalTimeoutId)
        globalTimeoutId = null
      }
      abortSignal?.removeEventListener('abort', onAbort)
    }

    async function terminateProcess(force = false) {
      await killProcessTree(proc.pid ?? undefined, force)
    }

    function dispatch(event: ReporterEvent) {
      eventCounts[event.type]++
      switch (event.type) {
        case 'env':
          handleEnvEvent(state, event, deps)
          break
        case 'step':
          handleStepEvent(state, event, deps)
          break
        case 'substep':
          state.pendingEmits.push(handleSubstepEvent(state, event, deps))
          break
        case 'log':
          handleLogEvent(state, event, deps)
          break
        case 'assertion':
          handleAssertionEvent(state, event, deps)
          break
        case 'captura-test':
          state.pendingEmits.push(handleCapturaTestEvent(state, event, deps))
          break
        case 'end':
          handleEndEvent(state, event)
          break
      }
    }

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
      const lines = stdout.split('\n')
      stdout = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        const event = parseReporterEvent(line)
        if (!event) continue
        dispatch(event)
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr = (stderr + data.toString()).slice(-STDERR_TAIL_BYTES)
    })

    // Cancelación: ahora push-based. InternalHttpController es quien EJECUTA
    // el kill real (SIGTERM → 5s de gracia → SIGKILL, vía kill-tree.ts) al
    // recibir POST /internal/cancel/:jobId; acá solo escuchamos la señal para
    // settlear la promesa como EjecucionCanceladaError en vez de como error
    // genérico cuando el proceso finalmente cierre. Reemplaza el polling
    // `isAborted()` de 1.5s del original, que existía porque antes la
    // cancelación se detectaba consultando una fila de DB en vez de recibir
    // un HTTP call directo.
    function onAbort() {
      aborted = true
    }
    if (abortSignal) {
      if (abortSignal.aborted) onAbort()
      else abortSignal.addEventListener('abort', onAbort)
    }

    proc.on('close', async (code) => {
      if (settled) return
      settled = true
      processExited = true
      cleanup()

      // Procesar cualquier evento pendiente en stdout que no terminó con \n
      if (stdout.trim()) {
        const event = parseReporterEvent(stdout.trim())
        if (event) dispatch(event)
      }

      const durationMs = Date.now() - startTime

      try {
        await Promise.all(state.pendingEmits)
      } catch (emitError) {
        logger.error(
          `[${jobId}] Error esperando emits pendientes: ${emitError instanceof Error ? emitError.message : String(emitError)}`,
        )
      }

      logger.log(
        `Job ${jobId} finalizado. Eventos: env=${eventCounts.env}, steps=${eventCounts.step}, substeps=${eventCounts.substep}, assertions=${eventCounts.assertion}, logs=${eventCounts.log}, capturas=${eventCounts['captura-test']}, end=${eventCounts.end}`,
      )

      // FIA-16: si el proceso ya había terminado con un resultado real (el
      // reporter emitió `end` paso/fallo y salió con 0/1) cuando llegó la
      // cancelación, se conserva ese resultado: ExecutionService emite `end`
      // y vortest-web lo descarta si la fila ya está `cancelado`. Si el
      // proceso seguía corriendo (interrumpido), es una cancelación real.
      const hasRealResult =
        (code === 0 || code === 1) &&
        (state.reporterEndEstado === 'paso' || state.reporterEndEstado === 'fallo')
      if (aborted && !hasRealResult) {
        reject(new EjecucionCanceladaError(`Job ${jobId} fue cancelado por el usuario`))
        return
      }

      const outputStorageState = readStorageState(jobId)
      cleanupStorageState(jobId)

      const result: RunPlaywrightResult = {
        passed: code === 0,
        durationMs,
        outputDir,
        outputStorageState: outputStorageState ?? undefined,
        pasoNumero: state.pasoNumero,
        asercionesTotal: state.assertionCounters.total,
        asercionesOk: state.assertionCounters.ok,
        asercionesFail: state.assertionCounters.fail,
        artifactUploadFailed: state.artifactUploadFailed,
      }

      if (code === 0 || code === 1) {
        resolve(result)
      } else {
        reject(new Error(`Playwright exited with code ${code}: ${stderr.slice(-200)}`))
      }
    })

    proc.on('error', (err) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    })

    globalTimeoutId = setTimeout(
      async () => {
        // Guard defensivo: si el proceso ya cerró y se resolvió/rechazó la
        // promesa justo cuando este timer disparaba (clearTimeout no llega a
        // tiempo de cancelarlo), evitamos hacer terminateProcess/esperas de
        // más sobre un proceso que ya no existe.
        if (settled) return
        logger.warn(`[${jobId}] Global timeout (${timeoutMs}ms) reached, terminating process tree`)
        await terminateProcess(false)
        await new Promise((r) => setTimeout(r, 5000))
        if (!processExited) {
          logger.warn(`[${jobId}] Grace period expired after timeout, forcing kill`)
          await terminateProcess(true)
          let waited = 0
          while (!processExited && waited < 8000) {
            await new Promise((r) => setTimeout(r, 500))
            waited += 500
          }
        }
        if (settled) return
        settled = true
        cleanup()
        if (!processExited) {
          logger.error(`[${jobId}] Process did not exit even after force kill`)
        }
        reject(new Error(`Playwright test timed out after ${timeoutMs}ms`))
      },
      timeoutMs,
    )
  })
}
