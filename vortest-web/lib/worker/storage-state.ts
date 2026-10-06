import * as fs from 'fs'
import * as path from 'path'

const RUNTIME_DIR = path.resolve(process.cwd(), 'runtime', 'storage-state')

export function ensureRuntimeDir(): void {
  fs.mkdirSync(RUNTIME_DIR, { recursive: true })
}

export function getStorageStatePath(ejecucionId: string): string {
  ensureRuntimeDir()
  return path.join(RUNTIME_DIR, `${ejecucionId}.json`)
}

export function writeStorageState(ejecucionId: string, state: unknown): void {
  const filePath = getStorageStatePath(ejecucionId)
  fs.writeFileSync(filePath, JSON.stringify(state ?? { cookies: [], origins: [] }, null, 2))
}

export function readStorageState(ejecucionId: string): unknown | null {
  const filePath = getStorageStatePath(ejecucionId)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  } catch {
    return null
  }
}

export function cleanupStorageState(ejecucionId: string): void {
  const filePath = getStorageStatePath(ejecucionId)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}
