// Ejecuta playwright test y parsea el output del reporter custom
import { spawn } from 'child_process'
import { prisma } from '@/lib/db'
import * as path from 'path'
import * as fs from 'fs'
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
  | EndEvent

const VALID_TYPES = new Set([
  'env',
  'step',
  'substep',
  'log',
  'assertion',
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
  assertionCounters: { total: number; ok: number; fail: number }
  envCaptured: boolean
  pendingInserts: Promise<unknown>[]
}

function createRunnerState(ejecucionId: string): RunnerState {
  return {
    ejecucionId,
    pasoNumero: 0,
    substepCounters: new Map(),
    logBuffers: new Map(),
    substepLogBuffers: new Map(),
    assertionCounters: { total: 0, ok: 0, fail: 0 },
    envCaptured: false,
    pendingInserts: [],
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
      logs: logs ? (logs as unknown as Prisma.InputJsonValue) : undefined,
    },
  }).catch((e) => {
    console.error('[runner] Error inserting paso:', e)
  })
  state.pendingInserts.push(insertPromise)
}

async function handleSubstepEvent(state: RunnerState, event: SubstepEvent): Promise<void> {
  const parentNumero = event.parentTestId
  const prev = state.substepCounters.get(parentNumero) ?? 0
  const substepNumero = prev + 1
  state.substepCounters.set(parentNumero, substepNumero)

  // Find the actual PasoEjecucion ID by numero + ejecucionId
  const paso = await prisma.pasoEjecucion.findFirst({
    where: { ejecucionId: state.ejecucionId, numero: parentNumero },
    select: { id: true },
  }).catch(() => null)

  if (!paso) {
    console.warn(`[runner] PasoEjecucion not found for parentTestId=${parentNumero}`)
    return
  }

  const logs = state.substepLogBuffers.get(`${parentNumero}:${substepNumero}`) ?? null

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
      logs: logs ? (logs as unknown as Prisma.InputJsonValue) : undefined,
    },
  }).catch((e) => {
    console.error('[runner] Error inserting substep:', e)
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
    ], {
      cwd: path.resolve(process.cwd(), 'runtime', 'ejecuciones'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0', PLAYWRIGHT_VORTEX_RUNNER: '1', PLAYWRIGHT_VORTEX_OUTPUT_DIR: outputDir },
    })

    let stdout = ''
    let stderr = ''
    let aborted = false
    let processExited = false

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

      const durationMs = Date.now() - startTime

      try {
        await Promise.all(state.pendingInserts)
      } catch (insertError) {
        console.error('[runner] Error inserting pasos:', insertError)
      }

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
