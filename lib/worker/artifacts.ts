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

      // Mover archivo con retry para Windows EPERM/EBUSY
      moveWithRetry(sourcePath, destPath)

      // Determinar tipo
      const tipo: ArtefactoTipo = fileName.endsWith('.webm') ? 'video' : 'captura'

      // Detectar fase de captura
      const phase = detectPhase(fileName)

      // Heurística para mapear pasoEjecucionId
      let pasoEjecucionId: string | null = null
      const stepMatch = fileName.match(/step-(\d+)/i)
      if (stepMatch) {
        const stepNum = parseInt(stepMatch[1], 10)
        const matchedPaso = pasos.find((p) => p.numero === stepNum)
        if (matchedPaso) {
          pasoEjecucionId = matchedPaso.id
        }
      }

      const metadata = phase ? { phase } : undefined

      const artefacto = await prisma.artefacto.create({
        data: {
          ejecucionId,
          pasoEjecucionId,
          tipo,
          nombre: fileName,
          path: destPath,
          sha256,
          bytes,
          metadata,
        },
      })

      // Si es captura con fase, intentar vincular a PasoSubaccion
      if (phase && pasoEjecucionId) {
        await linkCaptureToSubaccion(ejecucionId, pasoEjecucionId, artefacto.id, phase)
      }
    } catch (err) {
      console.error(`[artifacts] Error procesando ${sourcePath}:`, err)
      // Continuar con el siguiente archivo
    }
  }
}

function detectPhase(fileName: string): 'captura-actual' | 'captura-referencia' | null {
  const lower = fileName.toLowerCase()
  if (lower.includes('actual')) return 'captura-actual'
  if (lower.includes('reference') || lower.includes('expected')) return 'captura-referencia'
  return null
}

function moveWithRetry(sourcePath: string, destPath: string, maxRetries = 3): void {
  let lastErr: Error | undefined
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      fs.renameSync(sourcePath, destPath)
      return
    } catch (err: any) {
      lastErr = err
      const retryable = err.code === 'EPERM' || err.code === 'EBUSY'
      if (!retryable || attempt === maxRetries - 1) {
        throw err
      }
      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = 100 * Math.pow(2, attempt)
      const start = Date.now()
      while (Date.now() - start < delay) {
        // busy-wait sync delay
      }
    }
  }
  if (lastErr) throw lastErr
}

async function linkCaptureToSubaccion(
  ejecucionId: string,
  pasoEjecucionId: string,
  artefactoId: string,
  phase: 'captura-actual' | 'captura-referencia'
): Promise<void> {
  try {
    const subaccion = await prisma.pasoSubaccion.findFirst({
      where: { ejecucionId, pasoEjecucionId },
      orderBy: { numero: 'asc' },
      select: { id: true },
    })

    if (!subaccion) return

    const updateData = phase === 'captura-actual'
      ? { capturaActualId: artefactoId }
      : { capturaReferenciaId: artefactoId }

    await prisma.pasoSubaccion.update({
      where: { id: subaccion.id },
      data: updateData,
    })
  } catch (err) {
    console.error('[artifacts] Error linking capture to subaccion:', err)
  }
}
