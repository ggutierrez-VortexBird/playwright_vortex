// src/execution/script-writer.ts
// Escribe `job.scriptText` (ya con el hook afterEach de storageState y el
// templating de auto-reparación inyectados por vortest-web) a un archivo
// temporal real en disco, porque el CLI de Playwright necesita un archivo.
//
// Este es solo el `fs.writeFile` real de vortest-web/lib/worker/script-temp.ts
// — el templating del hook (`writeTempScript`'s storageStateHook string) se
// queda en vortest-web, que ya lo concatena en `scriptText` antes de publicar
// el job. El motor no genera texto de script, solo lo persiste a disco.
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'

const RUNTIME_DIR = path.resolve(process.cwd(), 'runtime', 'ejecuciones')

export async function writeTempScript(scriptText: string, fileName: string): Promise<string> {
  await fs.mkdir(RUNTIME_DIR, { recursive: true })

  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const unique = `${crypto.randomUUID().slice(0, 8)}-${sanitized}`
  const filePath = path.join(RUNTIME_DIR, unique)

  await fs.writeFile(filePath, scriptText, 'utf-8')
  return filePath
}

export async function cleanupTempScript(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath)
  } catch {
    // Si ya se borró o no existe, no hacer nada
  }
}

/**
 * Limpia el directorio runtime/ejecuciones de archivos viejos (>1 hora) para
 * evitar acumulación de scripts huérfanos entre reinicios del motor.
 */
export async function cleanupStaleScripts(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  try {
    const files = await fs.readdir(RUNTIME_DIR)
    const now = Date.now()
    for (const file of files) {
      const full = path.join(RUNTIME_DIR, file)
      try {
        const stat = await fs.stat(full)
        if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
          await fs.unlink(full)
        }
      } catch {
        // Ignorar errores individuales
      }
    }
  } catch {
    // Si la carpeta no existe, no hacer nada
  }
}
