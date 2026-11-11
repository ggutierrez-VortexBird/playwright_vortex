// Escribe job.scriptText a un archivo temporal, porque el CLI de Playwright lo necesita en disco
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

/** Borra scripts de más de 1 hora en runtime/ejecuciones */
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
