// Helpers para escribir script de la BD a archivo temporal y limpiarlo.
// IMPORTANTE: el archivo se crea dentro del testDir configurado en playwright.config.ts
// (./runtime/ejecuciones) para que Playwright lo detecte automáticamente.
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Directorio donde se escriben los scripts temporales. Coincide con el testDir
// de playwright.config.ts (resuelto relativo al cwd del proceso).
const RUNTIME_DIR = path.resolve(process.cwd(), 'runtime', 'ejecuciones')

export async function writeTempScript(script: string, fileName: string): Promise<string> {
  await fs.mkdir(RUNTIME_DIR, { recursive: true })

  // Sanitizar nombre de archivo (sin caracteres raros)
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  // Prefijo único por ejecución para evitar colisiones
  const unique = `${crypto.randomUUID().slice(0, 8)}-${sanitized}`
  const filePath = path.join(RUNTIME_DIR, unique)

  await fs.writeFile(filePath, script, 'utf-8')
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
 * Limpia el directorio runtime/ejecuciones de archivos viejos (>1 hora)
 * para evitar acumulación de scripts huérfanos.
 */
export async function cleanupStaleScripts(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  try {
    const files = await fs.readdir(RUNTIME_DIR)
    const now = Date.now()
    for (const file of files) {
      const full = path.join(RUNTIME_DIR, file)
      try {
        const stat = await fs.stat(full)
        if (now - stat.mtimeMs > maxAgeMs) {
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