// Ejecuta playwright test y parsea el output del reporter custom
import { spawn } from 'child_process'
import { prisma } from '@/lib/db'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { killProcessTree } from './kill-tree'
import { capLogs, LogEntry } from './log-cap'

// ============================================================
// Event types emitted by scripts/my-reporter.js
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
  estado: 'paso' | 'fallo' | 'reparado' | 'passed' | 'failed' | 'skipped'
  duracionMs: number
  selfHealed?: boolean
  errorMsg?: string | null
  resultadoEsperado?: string | null
  resultadoObtenido?: string | null
  errorCount?: number
  /**
   * HU-G18 — milliseconds from video start when this step began.
   * Emitted by my-reporter.js in onTestEnd, computed from
   * testStartMs - runStartMs. Optional for backwards compat with old
   * reporter versions and with events synthesized in tests.
   */
  videoInicioMs?: number
  /** HU-G18 — milliseconds from video start when this step ended. */
  videoFinMs?: number
}

export interface SubstepEvent {
  type: 'substep'
  parentTestId: number
  numero: number
  tipo: 'assertion' | 'action' | 'setup' | 'navigate' | 'other'
  descripcion: string
  estado: 'paso' | 'fallo' | 'reparado'
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

// ============================================================
// RunnerState — mutable state accumulated during a single run
// ============================================================

interface RunnerState {
  ejecucionId: string
  pasoNumero: number
  substepCounters: Map<number, number>
  logBuffers: Map<number, LogEntry[]>
  substepLogBuffers: Map<string, LogEntry[]>
  pendingSubsteps: Map<number, SubstepEvent[]>  // Buffer for substeps that arrive before their parent step
  assertionCounters: { total: number; ok: number; fail: number }
  envCaptured: boolean
  pendingInserts: Promise<unknown>[]
  /** Cursor para distribución de capturas por orden de ejecución */
  capturaCursor: { pasoEjecucionId: string | null; substepNumero: number }
}

function createRunnerState(ejecucionId: string): RunnerState {
  return {
    ejecucionId,
    pasoNumero: 0,
    substepCounters: new Map(),
    logBuffers: new Map(),
    substepLogBuffers: new Map(),
    pendingSubsteps: new Map(),
    assertionCounters: { total: 0, ok: 0, fail: 0 },
    envCaptured: false,
    pendingInserts: [],
    capturaCursor: { pasoEjecucionId: null, substepNumero: 0 },
  }
}

/**
 * Error thrown when the runner detects a user-initiated cancellation
 * (via the `isAborted` callback). The worker catches this and ensures
 * the BD row stays in `cancelado` state without overwriting it.
 */
export class EjecucionCanceladaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EjecucionCanceladaError'
  }
}

/**
 * HU-G15 — Auto-repair con selectores respaldo.
 *
 * El auto-repair ocurre DENTRO del script generado (HU-G11 +
 * `lib/worker/auto-repair.ts`): cada paso del .spec.ts envuelve su
 * locator en `tryWithReparacion(page, candidates, action)`, que itera
 * los selectores en orden hasta que uno funcione. Cuando usa un
 * respaldo (no el principal), el reporter emite `selfHealed=true`.
 *
 * Acá en el runner, la lógica es trivial:
 *   1) Recibir el evento `step` del reporter (auto-repair ya ocurrió
 *      en el browser).
 *   2) Persistir `selfHealed` en `PasoEjecucion.selfHealed` (ya se hace
 *      en `handleStepEvent`).
 *   3) El conteo "Reparados: N" del UI se hace con un helper puro
 *      `countReparadosFromPasos` desde `lib/worker/auto-repair.ts`.
 */

/**
 * Re-export del helper de auto-repair para mantener la superficie
 * del runner autocontenida y permitir tests del flujo end-to-end.
 */
export {
  tryWithReparacionTs,
  countReparadosFromPasos,
  type SelectorCandidate,
  type ReparacionResult,
} from "./auto-repair";

export function parseReporterEvent(line: string): ReporterEvent | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>
    if (!parsed.type || typeof parsed.type !== 'string') return null
    if (!VALID_TYPES.has(parsed.type)) return null
    return parsed as unknown as ReporterEvent
  } catch {
    return null
  }
}

// ============================================================
// Event handlers
// ============================================================

async function handleEnvEvent(state: RunnerState, event: EnvEvent): Promise<void> {
  if (state.envCaptured) return
  state.envCaptured = true
  const updatePromise = prisma.ejecucion.update({
    where: { id: state.ejecucionId },
    data: {
      navegador: event.navegador,
      sistemaOperativo: event.sistemaOperativo,
      nodoEjecucion: event.nodoEjecucion,
    },
  }).catch((e) => {
    console.error('[runner] Error updating env:', e)
  })
  state.pendingInserts.push(updatePromise)
}

async function handleStepEvent(state: RunnerState, event: StepEvent): Promise<void> {
  state.pasoNumero++
  const numero = state.pasoNumero

  let estado: 'paso' | 'fallo' | 'reparado'
  if (event.estado === 'passed' || event.estado === 'paso') {
    estado = 'paso'
  } else if (event.estado === 'failed' || event.estado === 'fallo') {
    estado = 'fallo'
  } else if (event.estado === 'reparado') {
    estado = 'reparado'
  } else if (event.estado === 'skipped') {
    estado = 'paso'
  } else {
    estado = 'fallo'
  }

  // Flush accumulated logs for this step
  const logs = state.logBuffers.get(numero) ?? null

  const insertPromise = prisma.pasoEjecucion.create({
    data: {
      ejecucionId: state.ejecucionId,
      numero,
      descripcion: event.descripcion,
      estado,
      duracionMs: event.duracionMs,
      selfHealed: event.selfHealed ?? false,
      errorMsg: event.errorMsg ?? null,
      resultadoEsperado: event.resultadoEsperado ?? null,
      resultadoObtenido: event.resultadoObtenido ?? null,
      errorCount: event.errorCount ?? 0,
      // HU-G18 — chapter timestamps. Optional in the event for backwards
      // compatibility with synthetic test events; when missing we leave
      // the columns NULL and the UI falls back to duration ratios.
      videoInicioMs: event.videoInicioMs ?? null,
      videoFinMs: event.videoFinMs ?? null,
      logs: logs ? (logs as unknown as Prisma.InputJsonValue) : undefined,
    },
  }).then(async () => {
    // After step is inserted, process any buffered substeps for this step
    const bufferedSubsteps = state.pendingSubsteps.get(numero)
    if (bufferedSubsteps && bufferedSubsteps.length > 0) {
      state.pendingSubsteps.delete(numero)
      for (const substepEvent of bufferedSubsteps) {
        // Use event.numero directly since it was already calculated when the event arrived
        await handleSubstepEvent(state, substepEvent, substepEvent.numero)
      }
    }
  }).catch((e) => {
    console.error(`[runner] Error inserting paso #${numero} (${event.descripcion}):`, e)
  })
  state.pendingInserts.push(insertPromise)
}

/**
 * Asegura que existe un Artefacto para el path dado y retorna su id.
 * Si ya existe (mismo sha256), retorna el id existente.
 */
async function ensureArtefacto(
  ejecucionId: string,
  filePath: string,
  nombre: string,
  tipo: 'captura'
): Promise<string | null> {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`[runner] Capture file not found: ${filePath}`)
      return null
    }

    const stats = fs.statSync(filePath)
    const bytes = stats.size

    // SHA256
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath)
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: string | Buffer) => {
        if (typeof chunk === 'string') hash.update(chunk, 'utf-8')
        else hash.update(chunk)
      })
      stream.on('end', () => resolve())
      stream.on('error', (err: Error) => reject(err))
    })
    const sha256 = hash.digest('hex')

    // Buscar si ya existe
    const existing = await prisma.artefacto.findFirst({
      where: { ejecucionId, sha256 },
      select: { id: true },
    })
    if (existing) return existing.id

    // Crear
    const artefacto = await prisma.artefacto.create({
      data: { ejecucionId, tipo, nombre, path: filePath, sha256, bytes },
    })
    return artefacto.id
  } catch (err) {
    console.error(`[runner] Error ensureArtefacto ${filePath}:`, err)
    return null
  }
}

async function handleSubstepEvent(state: RunnerState, event: SubstepEvent, forceNumero?: number): Promise<void> {
  const parentNumero = event.parentTestId
  // Use forceNumero (from buffer) if provided, otherwise calculate and increment counter
  const substepNumero = forceNumero ?? (() => {
    const prev = state.substepCounters.get(parentNumero) ?? 0
    const num = prev + 1
    state.substepCounters.set(parentNumero, num)
    return num
  })()

  // Find the actual PasoEjecucion ID by numero + ejecucionId
  const paso = await prisma.pasoEjecucion.findFirst({
    where: { ejecucionId: state.ejecucionId, numero: parentNumero },
    select: { id: true },
  }).catch(() => null)

  if (!paso) {
    // Buffer the substep to process later when the parent step arrives
    const pending = state.pendingSubsteps.get(parentNumero) ?? []
    pending.push(event)
    state.pendingSubsteps.set(parentNumero, pending)
    return
  }

  const logs = state.substepLogBuffers.get(`${parentNumero}:${substepNumero}`) ?? null

  // Procesar capturas (paths vienen del reporter)
  let capturaActualId: string | null = null
  let capturaReferenciaId: string | null = null

  if (event.capturaActualPath) {
    capturaActualId = await ensureArtefacto(
      state.ejecucionId,
      event.capturaActualPath,
      path.basename(event.capturaActualPath),
      'captura'
    )
  }

  if (event.capturaReferenciaPath) {
    capturaReferenciaId = await ensureArtefacto(
      state.ejecucionId,
      event.capturaReferenciaPath,
      path.basename(event.capturaReferenciaPath),
      'captura'
    )
  }

  const insertPromise = prisma.pasoSubaccion.create({
    data: {
      ejecucionId: state.ejecucionId,
      pasoEjecucionId: paso.id,
      numero: substepNumero,
      tipo: event.tipo,
      descripcion: event.descripcion,
      estado: event.estado,
      duracionMs: event.duracionMs,
      errorMsg: event.errorMsg ?? null,
      logs: logs ? (logs as Prisma.JsonValue) : undefined,
      capturaActualId,
      capturaReferenciaId,
    },
  }).catch((e) => {
    console.error(`[runner] Error inserting substep #${substepNumero} (${event.descripcion}) for step ${parentNumero}:`, e)
  })
  state.pendingInserts.push(insertPromise)
}

async function handleLogEvent(state: RunnerState, event: LogEvent): Promise<void> {
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
}

async function handleAssertionEvent(state: RunnerState, event: AssertionEvent): Promise<void> {
  state.assertionCounters.total++
  if (event.ok) {
    state.assertionCounters.ok++
  } else {
    state.assertionCounters.fail++
  }
}

/**
 * Maneja el evento captura-test: vincula las capturas de nivel test
 * (screenshot: 'on') al ÚLTIMO substep sin captura del paso, es decir, al
 * sub-paso real más reciente que se ejecutó — con hooks/fixtures ya fuera
 * de la lista de sub-pasos (ver scripts/my-reporter.js), es la acción que
 * estaba corriendo cuando Playwright tomó esta captura (la que falló, o la
 * última si el test pasó). No sobrescribe capturas ya existentes.
 */
async function handleCapturaTestEvent(state: RunnerState, event: CapturaTestEvent): Promise<void> {
  // Encontrar el paso por numero (parentTestId = testCounter = pasoNumero)
  const paso = await prisma.pasoEjecucion.findFirst({
    where: { ejecucionId: state.ejecucionId, numero: event.parentTestId },
    select: { id: true },
  }).catch(() => null)

  if (!paso) {
    console.warn(`[runner] captura-test: no se encontró paso numero ${event.parentTestId}`)
    return
  }

  // Buscar el último substep sin capturaActualId (el sub-paso real más reciente)
  const subaccion = await prisma.pasoSubaccion.findFirst({
    where: {
      ejecucionId: state.ejecucionId,
      pasoEjecucionId: paso.id,
      capturaActualId: null,
    },
    orderBy: { numero: 'desc' },
    select: { id: true },
  }).catch(() => null)

  if (!subaccion) {
    console.warn(`[runner] captura-test: no se encontró substep sin captura para paso ${paso.id}`)
    return
  }

  // Crear los artefactos si hay paths
  let capturaActualId: string | null = null
  let capturaReferenciaId: string | null = null

  if (event.capturaActualPath) {
    capturaActualId = await ensureArtefacto(
      state.ejecucionId,
      event.capturaActualPath,
      path.basename(event.capturaActualPath),
      'captura'
    )
  }

  if (event.capturaReferenciaPath) {
    capturaReferenciaId = await ensureArtefacto(
      state.ejecucionId,
      event.capturaReferenciaPath,
      path.basename(event.capturaReferenciaPath),
      'captura'
    )
  }

  // Actualizar el substep con las capturas (si aún no tiene)
  if (capturaActualId || capturaReferenciaId) {
    const updateData: { capturaActualId?: string | null; capturaReferenciaId?: string | null } = {}
    if (capturaActualId) updateData.capturaActualId = capturaActualId
    if (capturaReferenciaId) updateData.capturaReferenciaId = capturaReferenciaId

    const updatePromise = prisma.pasoSubaccion.update({
      where: { id: subaccion.id },
      data: updateData,
    }).catch((e) => {
      console.error('[runner] Error vinculando captura-test a substep:', e)
    })
    state.pendingInserts.push(updatePromise)
  }

  // Actualizar cursor
  state.capturaCursor = { pasoEjecucionId: paso.id, substepNumero: subaccion.numero }
}

async function handleEndEvent(state: RunnerState, event: EndEvent): Promise<void> {
  // Update assertion counters from reporter if they differ
  if (event.asercionesTotal > 0) {
    state.assertionCounters.total = event.asercionesTotal
    state.assertionCounters.ok = event.asercionesOk
    state.assertionCounters.fail = event.asercionesFail
  }

  const updatePromise = prisma.ejecucion.update({
    where: { id: state.ejecucionId },
    data: {
      asercionesTotal: state.assertionCounters.total,
      asercionesOk: state.assertionCounters.ok,
      asercionesFail: state.assertionCounters.fail,
    },
  }).catch((e) => {
    console.error('[runner] Error updating aserciones:', e)
  })
  state.pendingInserts.push(updatePromise)
}

// Import Prisma JsonValue type for logs casting
import { Prisma } from '@prisma/client'

// ============================================================
// Main runner
// ============================================================

export async function runPlaywrightTest(
  scriptPath: string,
  ejecucionId: string,
  isAborted?: () => Promise<boolean> | boolean
): Promise<{ passed: boolean; durationMs: number; outputDir: string }> {
  const outputDir = path.resolve(process.cwd(), 'runtime', 'ejecuciones', 'output', ejecucionId)
  fs.mkdirSync(outputDir, { recursive: true })

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    const state = createRunnerState(ejecucionId)
    let settled = false

    const configPath = path.resolve(process.cwd(), 'playwright.config.ts')
    const scriptName = path.basename(scriptPath)

    const cliPath = path.resolve(
      process.cwd(),
      'node_modules',
      '@playwright',
      'test',
      'cli.js'
    )

    const proc = spawn('node', [
      cliPath,
      'test', scriptName,
      `--config=${configPath}`,
      `--output=${outputDir}`,
    ], {
      cwd: path.resolve(process.cwd(), 'runtime', 'ejecuciones'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', PLAYWRIGHT_VORTEX_RUNNER: '1', PLAYWRIGHT_VORTEX_OUTPUT_DIR: outputDir },
    })

    let stdout = ''
    let stderr = ''
    let aborted = false
    let processExited = false
    let eventCounts = { env: 0, step: 0, substep: 0, log: 0, assertion: 0, 'captura-test': 0, end: 0 }

    let abortInterval: NodeJS.Timeout | null = null
    let graceTimeout: NodeJS.Timeout | null = null
    let globalTimeoutId: NodeJS.Timeout | null = null

    function cleanup() {
      if (abortInterval) { clearInterval(abortInterval); abortInterval = null }
      if (graceTimeout) { clearTimeout(graceTimeout); graceTimeout = null }
      if (globalTimeoutId) { clearTimeout(globalTimeoutId); globalTimeoutId = null }
    }

    async function terminateProcess(force = false) {
      await killProcessTree(proc.pid ?? undefined, force)
    }

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
      const lines = stdout.split('\n')
      stdout = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        const event = parseReporterEvent(line)
        if (!event) continue

        eventCounts[event.type]++

        switch (event.type) {
          case 'env':
            state.pendingInserts.push(handleEnvEvent(state, event))
            break
          case 'step':
            state.pendingInserts.push(handleStepEvent(state, event))
            break
          case 'substep':
            state.pendingInserts.push(handleSubstepEvent(state, event))
            break
          case 'log':
            handleLogEvent(state, event)
            break
          case 'assertion':
            handleAssertionEvent(state, event)
            break
          case 'captura-test':
            state.pendingInserts.push(handleCapturaTestEvent(state, event))
            break
          case 'end':
            state.pendingInserts.push(handleEndEvent(state, event))
            break
        }
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    const ABORT_POLL_MS = 1500
    if (isAborted) {
      abortInterval = setInterval(async () => {
        try {
          if (await isAborted()) {
            aborted = true
            if (abortInterval) { clearInterval(abortInterval); abortInterval = null }
            await terminateProcess(false)
            graceTimeout = setTimeout(async () => {
              if (!processExited) {
                console.warn('[runner] Grace period expired, forcing kill')
                await terminateProcess(true)
              }
            }, 5000)
          }
        } catch (e) {
          console.error('[runner] Error polling abort:', e)
        }
      }, ABORT_POLL_MS)
    }

    proc.on('close', async (code) => {
      if (settled) return
      settled = true
      processExited = true
      cleanup()

      // Procesar cualquier evento pendiente en stdout que no terminó con \n
      if (stdout.trim()) {
        const event = parseReporterEvent(stdout.trim())
        if (event) {
          eventCounts[event.type]++
          switch (event.type) {
            case 'env': state.pendingInserts.push(handleEnvEvent(state, event)); break
            case 'step': state.pendingInserts.push(handleStepEvent(state, event)); break
            case 'substep': state.pendingInserts.push(handleSubstepEvent(state, event)); break
            case 'log': handleLogEvent(state, event); break
            case 'assertion': handleAssertionEvent(state, event); break
            case 'captura-test': state.pendingInserts.push(handleCapturaTestEvent(state, event)); break
            case 'end': state.pendingInserts.push(handleEndEvent(state, event)); break
          }
        }
      }

      const durationMs = Date.now() - startTime

      try {
        await Promise.all(state.pendingInserts)
      } catch (insertError) {
        console.error('[runner] Error inserting pasos:', insertError)
      }

      console.log(`[runner] Ejecución ${ejecucionId} finalizada. Eventos: env=${eventCounts.env}, steps=${eventCounts.step}, substeps=${eventCounts.substep}, assertions=${eventCounts.assertion}, logs=${eventCounts.log}, capturas=${eventCounts['captura-test']}, end=${eventCounts.end}`)
      console.log(`[runner] Pasos insertados: ${state.pasoNumero}, pending inserts: ${state.pendingInserts.length}`)

      if (aborted) {
        reject(new EjecucionCanceladaError(`Ejecución ${ejecucionId} fue cancelada por el usuario`))
        return
      }

      if (code === 0) {
        resolve({ passed: true, durationMs, outputDir })
      } else if (code === 1) {
        resolve({ passed: false, durationMs, outputDir })
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

    globalTimeoutId = setTimeout(async () => {
      console.warn('[runner] Global timeout (10min) reached, terminating process tree')
      await terminateProcess(false)
      await new Promise(r => setTimeout(r, 5000))
      if (!processExited) {
        console.warn('[runner] Grace period expired after timeout, forcing kill')
        await terminateProcess(true)
        let waited = 0
        while (!processExited && waited < 8000) {
          await new Promise(r => setTimeout(r, 500))
          waited += 500
        }
      }
      if (settled) return
      settled = true
      cleanup()
      if (!processExited) {
        console.error('[runner] Process did not exit even after force kill')
      }
      reject(new Error('Playwright test timed out after 10 minutes'))
    }, 10 * 60 * 1000)
  })
}
