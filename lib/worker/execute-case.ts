// Lógica compartida para ejecutar un caso de prueba con Playwright.
// Usada por el worker de ejecuciones (scripts/worker.ts), incluyendo la
// ejecución previa de un caso padre cuando el caso a correr declara uno.
import { Prisma, type CasoPrueba, type Ejecucion } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  writeTempScript,
  cleanupTempScript,
} from './script-temp'
import { validateScript } from './validate-script'
import { runPlaywrightTest, EjecucionCanceladaError } from './runner'
import { collectArtifacts } from './artifacts'

export interface RunCaseResult {
  finalEstado: Ejecucion['estado']
  durationMs?: number
  outputStorageState?: unknown
  errorMsg?: string
}

/**
 * Ejecuta un caso de prueba y retorna su estado final + storageState resultante.
 * NO crea ni persiste la Ejecucion: es responsabilidad del llamador crear la
 * fila antes de llamar esta función y persistir el resultado después.
 *
 * @param ejecucionId ID de la Ejecucion ya existente (estado 'corriendo')
 * @param caso CasoPrueba a ejecutar
 * @param inputStorageState storageState opcional del caso padre
 */
export interface RunCaseExecutionOptions {
  inputStorageState?: unknown
}

export async function runCaseExecution(
  ejecucionId: string,
  caso: CasoPrueba,
  options: RunCaseExecutionOptions = {}
): Promise<RunCaseResult> {
  const { inputStorageState } = options
  // Validar script
  const validation = validateScript(caso.script, caso.scriptFileName ?? null)
  if (!validation.valid) {
    return {
      finalEstado: 'errorMotor',
      errorMsg: validation.error ?? 'Script inválido',
    }
  }

  // Escribir a archivo temporal
  const tmpPath = await writeTempScript(
    caso.script,
    caso.scriptFileName ?? 'test.spec.ts'
  )

  try {
    const runOptions: import('@/lib/worker/runner').RunPlaywrightOptions = {
      inputStorageState,
      isAborted: async () => {
        const current = await prisma.ejecucion.findUnique({
          where: { id: ejecucionId },
          select: { estado: true },
        })
        return current?.estado === 'cancelado'
      },
    }

    const result = await runPlaywrightTest(tmpPath, ejecucionId, runOptions)

    // Determinar estado final basado en los pasos:
    // - Si hay algún paso con 'fallo' y sin selfHeal, el resultado es 'fallo'
    // - De lo contrario, es 'paso' (incluye casos con pasos 'reparado')
    const pasos = await prisma.pasoEjecucion.findMany({
      where: { ejecucionId },
    })

    // HU-FIX: si no hay pasos, el test no ejecutó realmente (script vacío,
    // error silencioso, o reporter no funcionó). No debe marcar como 'paso'.
    if (pasos.length === 0) {
      console.error(`[execute-case] Ejecución ${ejecucionId} terminó sin pasos — posible script vacío o error silencioso`)
      return {
        finalEstado: 'errorMotor',
        durationMs: result.durationMs,
        outputStorageState: result.outputStorageState,
        errorMsg: 'La ejecución no generó pasos. Posibles causas: script vacío, error de sintaxis no reportado, o falla del reporter.',
      }
    }

    const hasUnhealedFailure = pasos.some(
      (p) => p.estado === 'fallo' && !p.selfHealed
    )

    // Recolectar artefactos (video/capturas) generados por Playwright
    try {
      await collectArtifacts(ejecucionId, result.outputDir)
    } catch (collectErr) {
      console.error(`[execute-case] Error recolectando artefactos para ${ejecucionId}:`, collectErr)
    }

    const finalEstado = hasUnhealedFailure ? 'fallo' : 'paso'

    return {
      finalEstado,
      durationMs: result.durationMs,
      outputStorageState: result.outputStorageState,
    }
  } catch (e: unknown) {
    if (e instanceof EjecucionCanceladaError) {
      console.log(`[execute-case] Ejecución ${ejecucionId} cancelada por el usuario`)
      return { finalEstado: 'cancelado' }
    }
    const message = e instanceof Error ? e.message : String(e)
    return { finalEstado: 'errorMotor', errorMsg: message }
  } finally {
    await cleanupTempScript(tmpPath)
  }
}

/**
 * Persiste el resultado de una ejecución en la BD.
 */
export async function persistExecutionResult(
  ejecucionId: string,
  result: RunCaseResult
): Promise<void> {
  await prisma.ejecucion.update({
    where: { id: ejecucionId },
    data: {
      estado: result.finalEstado,
      finAt: new Date(),
      duracionMs: result.durationMs,
      errorMsg: result.errorMsg ?? null,
      storageState: result.outputStorageState
        ? (result.outputStorageState as Prisma.InputJsonValue)
        : Prisma.DbNull,
    },
  })
}
