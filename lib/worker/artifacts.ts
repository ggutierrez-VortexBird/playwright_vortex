import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { prisma } from '@/lib/db'
import { ArtefactoTipo } from '@prisma/client'

/**
 * Escanea el directorio de salida de Playwright (incluyendo subdirectorios),
 * computa hash SHA256, mueve los archivos a storage/artefactos/<ejecucionId>/
 * e inserta filas en la tabla Artefacto.
 *
 * Playwright organiza los artefactos en subdirectorios por test run:
 *   outputDir/
 *     test-run-name-chromium/
 *       video.webm
 *       screenshot.png
 *       ...
 */
export async function collectArtifacts(
  ejecucionId: string,
  outputDir: string
): Promise<void> {
  const storageDir = path.resolve(process.cwd(), 'storage', 'artefactos', ejecucionId)

  let entries: string[] = []
  try {
    entries = fs.readdirSync(outputDir)
  } catch {
    // Directorio no existe o no es legible — nada que procesar
    return
  }

  // Recolectar todos los archivos de artefactos (directorios y archivos sueltos)
  const artefactoPaths: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(outputDir, entry)
    const stat = fs.statSync(entryPath)

    if (stat.isDirectory()) {
      // Es un subdirectorio (test run de Playwright) — buscar artefactos dentro
      try {
        const subFiles = fs.readdirSync(entryPath)
        for (const subFile of subFiles) {
          if (
            subFile.startsWith('video') && subFile.endsWith('.webm') ||
            subFile.endsWith('.png')
          ) {
            artefactoPaths.push(path.join(entryPath, subFile))
          }
        }
      } catch {
        // Error al leer subdirectorio — continuar
      }
    } else {
      // Archivo suelto en outputDir (edge case)
      if (
        entry.startsWith('video') && entry.endsWith('.webm') ||
        entry.endsWith('.png')
      ) {
        artefactoPaths.push(entryPath)
      }
    }
  }

  if (artefactoPaths.length === 0) {
    return
  }

  // Cargar pasos para heurística de mapeo por número
  const pasos = await prisma.pasoEjecucion.findMany({
    where: { ejecucionId },
    select: { id: true, numero: true },
  })

  fs.mkdirSync(storageDir, { recursive: true })

  for (const sourcePath of artefactoPaths) {
    const fileName = path.basename(sourcePath)
    try {
      const destPath = path.join(storageDir, fileName)

      // Calcular SHA256
      const hash = crypto.createHash('sha256')
      const stream = fs.createReadStream(sourcePath)
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: string | Buffer) => {
          if (typeof chunk === 'string') {
            hash.update(chunk, 'utf-8')
          } else {
            hash.update(chunk)
          }
        })
        stream.on('end', () => resolve())
        stream.on('error', (err: Error) => reject(err))
      })
      const sha256 = hash.digest('hex')

      // Obtener tamaño del archivo
      const stats = fs.statSync(sourcePath)
      const bytes = stats.size

      // Mover archivo
      fs.renameSync(sourcePath, destPath)

      // Determinar tipo
      const tipo: ArtefactoTipo = fileName.endsWith('.webm') ? 'video' : 'captura'

      // Heurística para mapear pasoEjecucionId
      // Playwright guarda el video principal como "video.webm" (primer video de la primera página)
      // y videos adicionales como "video-1.webm", "video-2.webm", etc.
      let pasoEjecucionId: string | null = null
      const stepMatch = fileName.match(/step-(\d+)/i)
      if (stepMatch) {
        const stepNum = parseInt(stepMatch[1], 10)
        const matchedPaso = pasos.find((p) => p.numero === stepNum)
        if (matchedPaso) {
          pasoEjecucionId = matchedPaso.id
        }
      }

      await prisma.artefacto.create({
        data: {
          ejecucionId,
          pasoEjecucionId,
          tipo,
          nombre: fileName,
          path: destPath,
          sha256,
          bytes,
        },
      })
    } catch (err) {
      console.error(`[artifacts] Error procesando ${sourcePath}:`, err)
      // Continuar con el siguiente archivo
    }
  }
}
