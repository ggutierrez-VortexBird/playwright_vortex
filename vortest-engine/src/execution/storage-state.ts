// storageState de cada job en runtime/storage-state/<jobId>.json; playwright.config.ts solo lee archivos
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
