// Ejecuta playwright test y parsea el output del reporter custom
import { spawn } from 'child_process'
import { prisma } from '@/lib/db'
import * as path from 'path'

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

export function parseReporterEvent(line: string): ReporterEvent | null {
  try {
    return JSON.parse(line) as ReporterEvent
  } catch {
    return null
  }
}

export async function runPlaywrightTest(
  scriptPath: string,
  ejecucionId: string
): Promise<{ passed: boolean; durationMs: number }> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let pasoNumero = 0
    // Bug 6 fix: collect pending inserts so we can await them before resolving
    const pendingInserts: Promise<unknown>[] = []

    const configPath = path.resolve(process.cwd(), 'playwright.config.ts')

    // Pasar solo el nombre del archivo (no la ruta absoluta) — Playwright lo busca
    // dentro de su testDir configurado.
    const scriptName = path.basename(scriptPath)

    // NOTA: el reporter custom está definido en playwright.config.ts para que
    // el path sea absoluto y no falle al resolverlo relativo al cwd del spawn.
    const proc = spawn('npx', [
      'playwright', 'test', scriptName,
      `--config=${configPath}`,
    ], {
      cwd: path.resolve(process.cwd(), 'runtime', 'ejecuciones'),
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true, // necesario en Windows para resolver npx.cmd
      env: { ...process.env, FORCE_COLOR: '0' },
    })

    let stdout = ''
    let stderr = ''

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

    proc.on('close', async (code) => {
      const durationMs = Date.now() - startTime

      // Bug 6 fix: await all pending inserts before resolving
      try {
        await Promise.all(pendingInserts)
      } catch (insertError) {
        console.error('[runner] Error inserting pasos:', insertError)
      }

      if (code === 0) {
        resolve({ passed: true, durationMs })
      } else if (code === 1) {
        resolve({ passed: false, durationMs })
      } else {
        reject(new Error(`Playwright exited with code ${code}: ${stderr.slice(-200)}`))
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })

    // Timeout global de 5 minutos
    const timeoutId = setTimeout(() => {
      proc.kill('SIGTERM')
      reject(new Error('Playwright test timed out after 5 minutes'))
    }, 5 * 60 * 1000)

    proc.on('close', () => clearTimeout(timeoutId))
  })
}
