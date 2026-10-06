// src/execution/storage-state.ts
// Mecánica LOCAL de lectura/escritura de storageState para un job, basada en
// archivos en runtime/storage-state/<jobId>.json — ported near-verbatim from
// vortest-web/lib/worker/storage-state.ts.
//
// Diferencia deliberada vs. el original: el VALOR de entrada ya no se lee de
// un archivo compartido escrito por otro proceso — llega inline en
// `ExecuteJobMessage.inputStorageState`. El VALOR de salida ya no se deja
// solo en disco para que "el próximo job lo lea" — se incluye en el
// `EndEventPayload.outputStorageState` para que el caller (web) decida qué
// hacer con él (encadenamiento padre/hijo). Los archivos siguen existiendo
// como mecanismo de paso intermedio porque playwright.config.ts (vía
// PLAYWRIGHT_STORAGE_STATE / PLAYWRIGHT_STORAGE_STATE_OUTPUT) solo sabe leer
// y escribir archivos, no valores en memoria.
import * as fs from 'fs'
import * as path from 'path'

const RUNTIME_DIR = path.resolve(process.cwd(), 'runtime', 'storage-state')

export function ensureRuntimeDir(): void {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true })
}

export function getStorageStatePath(jobId: string): string {
  ensureRuntimeDir()
  return path.join(RUNTIME_DIR, `${jobId}.json`)
}

export function writeStorageState(jobId: string, state: unknown): void {
  const filePath = getStorageStatePath(jobId)
  fs.writeFileSync(filePath, JSON.stringify(state ?? { cookies: [], origins: [] }, null, 2))
}

export function readStorageState(jobId: string): unknown | null {
  const filePath = getStorageStatePath(jobId)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

export function cleanupStorageState(jobId: string): void {
  const filePath = getStorageStatePath(jobId)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}
