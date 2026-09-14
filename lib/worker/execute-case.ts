// Lógica compartida para ejecutar un caso de prueba con Playwright.
// Usada por el worker de ejecuciones (scripts/worker.ts) y por el modo
// grabador cuando necesita ejecutar un caso padre para obtener su
// storageState antes de abrir el navegador.
import { randomUUID } from 'node:crypto'
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
  mode?: 'normal' | 'parent'
  inputStorageState?: unknown
}

export async function runCaseExecution(
  ejecucionId: string,
  caso: CasoPrueba,
  options: RunCaseExecutionOptions = {}
): Promise<RunCaseResult> {
  const { mode = 'normal', inputStorageState } = options
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
      mode,
      inputStorageState,
    }

    // Solo las ejecuciones normales consultan la BD para detectar cancelación.
    if (mode === 'normal') {
      runOptions.isAborted = async () => {
        const current = await prisma.ejecucion.findUnique({
          where: { id: ejecucionId },
          select: { estado: true },
        })
        return current?.estado === 'cancelado'
      }
    }

    const result = await runPlaywrightTest(tmpPath, ejecucionId, runOptions)

    // Modo parent: no hay pasos en BD ni artefactos que recolectar.
    if (mode === 'parent') {
      return {
        finalEstado: result.passed ? 'paso' : 'fallo',
        durationMs: result.durationMs,
        outputStorageState: result.outputStorageState,
      }
    }

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

/**
 * Ejecuta un caso padre y retorna su storageState fresco.
 * Usado por el modo grabador para iniciar el navegador ya autenticado.
 *
 * @returns storageState si el padre pasa; lanza error con {status, body} si falla.
 */
export async function executeParentCaseForStorageState(
  parentCaseId: string,
  proyectoId: string
): Promise<unknown> {
  const parentCase = await prisma.casoPrueba.findUnique({
    where: { id: parentCaseId },
  })

  if (!parentCase) {
    throw { status: 400, body: { error: 'validation', message: 'Caso padre no encontrado' } }
  }
  if (parentCase.proyectoId !== proyectoId) {
    throw { status: 400, body: { error: 'validation', message: 'El caso padre debe pertenecer al mismo proyecto' } }
  }
  if (parentCase.activo === false) {
    throw { status: 400, body: { error: 'validation', message: 'El caso padre está inactivo' } }
  }

  console.log(`[execute-case] Ejecutando caso padre ${parentCaseId} en modo volátil para capturar storageState`)

  try {
    const parentEjecucionId = `parent-${randomUUID()}`
    const result = await runCaseExecution(parentEjecucionId, parentCase, {
      mode: 'parent',
    })

    if (result.finalEstado !== 'paso') {
      throw {
        status: 400,
        body: {
          error: 'parent_failed',
          message: `El caso padre falló (${result.finalEstado}): ${result.errorMsg || 'sin mensaje'}`,
        },
      }
    }

    if (!result.outputStorageState) {
      throw {
        status: 400,
        body: {
          error: 'parent_no_state',
          message: 'El caso padre no generó storageState. Asegurate de que el caso de login persista la sesión.',
        },
      }
    }

    console.log(`[execute-case] Caso padre ${parentCaseId} ejecutado correctamente. StorageState capturado.`)
    return result.outputStorageState
  } catch (err: unknown) {
    // Si ya es nuestro error con status/body, dejarlo pasar
    if (err && typeof err === 'object' && 'status' in err) {
      throw err
    }
    throw {
      status: 500,
      body: {
        error: 'parent_execution_error',
        message: err instanceof Error ? err.message : 'Error ejecutando caso padre',
      },
    }
  }
}
