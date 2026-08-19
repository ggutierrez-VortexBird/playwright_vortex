// Ejecuta playwright test y parsea el output del reporter custom
import { spawn } from 'child_process'
import { prisma } from '@/lib/db'
import * as path from 'path'
import * as fs from 'fs'
import { killProcessTree } from './kill-tree'

interface StepEvent {
  type: 'step'
  numero: number
  descripcion: string
  estado: 'paso' | 'fallo' | 'reparado' | 'passed' | 'failed' | 'skipped'
  duracionMs: number
  selfHealed?: boolean
  errorMsg?: string
}

interface EndEvent {
  type: 'end'
  estado: string
  duracionMs: number
}

type ReporterEvent = StepEvent | EndEvent

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
    return JSON.parse(line) as ReporterEvent
  } catch {
    return null
  }
}

export async function runPlaywrightTest(
  scriptPath: string,
  ejecucionId: string,
  isAborted?: () => Promise<boolean> | boolean
): Promise<{ passed: boolean; durationMs: number; outputDir: string }> {
  const outputDir = path.resolve(process.cwd(), 'runtime', 'ejecuciones', 'output', ejecucionId)
  fs.mkdirSync(outputDir, { recursive: true })

  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let pasoNumero = 0
    // Bug 6 fix: collect pending inserts so we can await them before resolving
    const pendingInserts: Promise<unknown>[] = []
    let settled = false

    const configPath = path.resolve(process.cwd(), 'playwright.config.ts')

    // Pasar solo el nombre del archivo (no la ruta absoluta) — Playwright lo busca
    // dentro de su testDir configurado.
    const scriptName = path.basename(scriptPath)

    // Fix: ejecutar el CLI de Playwright directamente con Node.js.
    // En Windows, los archivos .cmd no pueden ejecutarse con spawn sin
    // shell:true (da EINVAL). El wrapper .cmd simplemente hace:
    //   @node "%~dp0\..\@playwright\test\cli.js" %*
    // Así que invocamos node + cli.js directamente, evitando tanto el
    // CMD intermedio como el overhead de npx. Esto funciona en Windows,
    // Linux y macOS.
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
      // shell: false — sin CMD intermedio en Windows
      env: { ...process.env, FORCE_COLOR: '0', PLAYWRIGHT_VORTEX_RUNNER: '1', PLAYWRIGHT_VORTEX_OUTPUT_DIR: outputDir },
    })

    let stdout = ''
    let stderr = ''
    // HU-3 Botón Detener: track si la ejecución fue abortada por el usuario
    let aborted = false
    let processExited = false

    // Timers y handles que debemos limpiar
    let abortInterval: NodeJS.Timeout | null = null
    let graceTimeout: NodeJS.Timeout | null = null
    let globalTimeoutId: NodeJS.Timeout | null = null

    function cleanup() {
      if (abortInterval) {
        clearInterval(abortInterval)
        abortInterval = null
      }
      if (graceTimeout) {
        clearTimeout(graceTimeout)
        graceTimeout = null
      }
      if (globalTimeoutId) {
        clearTimeout(globalTimeoutId)
        globalTimeoutId = null
      }
    }

    async function terminateProcess(force = false) {
      await killProcessTree(proc.pid ?? undefined, force)
    }

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
      // Parsear líneas JSON del reporter custom
      const lines = stdout.split('\n')
      stdout = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.trim()) continue
        const event = parseReporterEvent(line)
        if (event && event.type === 'step') {
          pasoNumero++
          // Map estado from reporter (passed/paso, failed/fallo, skipped) to Prisma enum values
          let estado: 'paso' | 'fallo' | 'reparado'
          if (event.estado === 'passed' || event.estado === 'paso') {
            estado = 'paso'
          } else if (event.estado === 'failed' || event.estado === 'fallo') {
            estado = 'fallo'
          } else if (event.estado === 'skipped') {
            estado = 'paso'
          } else {
            estado = 'fallo'
          }

          const insertPromise = prisma.pasoEjecucion.create({
            data: {
              ejecucionId,
              numero: pasoNumero,
              descripcion: event.descripcion,
              estado,
              duracionMs: event.duracionMs,
              selfHealed: event.selfHealed ?? false,
              errorMsg: event.errorMsg ?? null,
            }
          }).catch((e) => {
            console.error('[runner] Error inserting paso:', e)
          })
          pendingInserts.push(insertPromise)
        }
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    // HU-3 Botón Detener: poll periódico de cancelación.
    // Si `isAborted` se provee, cada 1.5s consultamos si el usuario canceló.
    // Si retorna true → kill árbol de procesos y reject con EjecucionCanceladaError
    // cuando el proceso cierre.
    const ABORT_POLL_MS = 1500
    if (isAborted) {
      abortInterval = setInterval(async () => {
        try {
          if (await isAborted()) {
            aborted = true
            if (abortInterval) {
              clearInterval(abortInterval)
              abortInterval = null
            }
            // Intentar terminación graceful (SIGTERM / taskkill /T)
            await terminateProcess(false)
            // Grace period: si en 5s no murió, forzar (SIGKILL / taskkill /T /F)
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

      // Bug 6 fix: await all pending inserts before resolving
      try {
        await Promise.all(pendingInserts)
      } catch (insertError) {
        console.error('[runner] Error inserting pasos:', insertError)
      }

      // Si fue cancelado por el usuario, el estado en BD ya es 'cancelado'.
      // Rechazamos con error específico para que el worker NO lo marque como errorMotor.
      if (aborted) {
        reject(
          new EjecucionCanceladaError(
            `Ejecución ${ejecucionId} fue cancelada por el usuario`
          )
        )
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

    // Timeout global de 10 minutos
    globalTimeoutId = setTimeout(async () => {
      console.warn('[runner] Global timeout (10min) reached, terminating process tree')
      await terminateProcess(false)
      
      // Grace period de 5s para que el proceso cierre limpiamente
      await new Promise(r => setTimeout(r, 5000))
      
      if (!processExited) {
        console.warn('[runner] Grace period expired after timeout, forcing kill')
        await terminateProcess(true)
        // Esperar hasta 8s adicionales para que el force kill funcione
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
