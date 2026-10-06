// Sin 'use server' a propósito: en un archivo con esa directiva cada export se vuelve un endpoint invocable desde el navegador.
import { prisma } from '@/lib/db'
import { buildScriptText } from '@/lib/worker/script-temp'
import { env } from '@/lib/env'
import type { ExecuteJobMessage } from '@/lib/queue/engine-contract'
import { decryptCredencial } from '@/lib/credenciales/crypto'

const EJECUCION_TIMEOUT_MS = env.EJECUCION_TIMEOUT_MS || 10 * 60 * 1000
const DEFAULT_SCRIPT_FILE_NAME = 'test.spec.ts'

export type Navegador = 'chromium' | 'firefox' | 'webkit'

export function buildExecuteJob(params: {
  jobId: string
  script: string
  scriptFileName: string | null
  inputStorageState?: unknown
  navegador: string
}): ExecuteJobMessage {
  return {
    jobId: params.jobId,
    scriptText: buildScriptText(params.script),
    scriptFileName: params.scriptFileName ?? DEFAULT_SCRIPT_FILE_NAME,
    inputStorageState: params.inputStorageState,
    timeoutMs: EJECUCION_TIMEOUT_MS,
    publishedAt: new Date().toISOString(),
    navegador: params.navegador as Navegador,
  }
}

/** Marca una Ejecucion como fallida sin haber llegado a correr, para no dejar una fila 'pendiente'/'corriendo' que nada va a recoger. */
export async function markPublishFailed(ejecucionId: string, detail: string, cause?: unknown): Promise<void> {
  console.error(`[dispatch] Fallo de publicación para ejecución ${ejecucionId}:`, cause ?? detail)
  await prisma.ejecucion
    .update({
      where: { id: ejecucionId },
      data: {
        estado: 'errorMotor',
        errorMsg: `No se pudo encolar la ejecución: ${detail}`,
        finAt: new Date(),
      },
    })
    .catch((err) => {
      console.error(`[dispatch] Error marcando ${ejecucionId} como errorMotor tras fallo de publish:`, err)
    })
}

/** storageState de la credencial con la que se grabó el caso (última sesión), o undefined. Misma regla que el grabador: el storageState del caso padre tiene prioridad. */
export async function storageStateDeCredencialDelCaso(casoPruebaId: string): Promise<unknown> {
  const sesion = await prisma.sesionGrabacion.findFirst({
    where: { casoPruebaId, credencialId: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { credencial: { select: { valor: true } } },
  })
  if (!sesion?.credencial) return undefined
  try {
    return JSON.parse(decryptCredencial(sesion.credencial.valor as Buffer))
  } catch (err) {
    console.error(`[dispatch] Credencial del caso ${casoPruebaId} no es un storageState JSON válido:`, err)
    return undefined
  }
}
