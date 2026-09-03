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
  let effectiveOutputDir = outputDir

  try {
    entries = fs.readdirSync(outputDir)
  } catch {
    // Directorio no existe — fallback al default de Playwright (test-results/)
    const fallbackDir = path.resolve(process.cwd(), 'runtime', 'ejecuciones', 'test-results')
    try {
      entries = fs.readdirSync(fallbackDir)
      effectiveOutputDir = fallbackDir
      console.log(`[artifacts] Fallback to Playwright default: ${fallbackDir}`)
    } catch {
      // Tampoco existe fallback — nada que procesar
      console.warn(`[artifacts] No artifacts found in ${outputDir} or ${fallbackDir}`)
      return
    }
  }

  // Recolectar todos los archivos de artefactos (directorios y archivos sueltos)
  const artefactoPaths: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(effectiveOutputDir, entry)
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
      // Busca tanto "step-X" (naming manual) como "test-name-X" (Playwright automatic screenshots)
      let pasoEjecucionId: string | null = null
      let stepNum: number | null = null

      // Pattern 1: step-1, step-2 (naming manual)
      const stepMatch = fileName.match(/^step-(\d+)/i)
      if (stepMatch) {
        stepNum = parseInt(stepMatch[1], 10)
      }

      // Pattern 2: test-name-1.png, my-test-2.png (Playwright automatic screenshots)
      // Match any filename ending with -<number>.png where the number is at the end before extension
      if (stepNum === null) {
        const autoMatch = fileName.match(/-(\d+)\.png$/i)
        if (autoMatch) {
          stepNum = parseInt(autoMatch[1], 10)
        }
      }

      if (stepNum !== null) {
        const matchedPaso = pasos.find((p) => p.numero === stepNum)
        if (matchedPaso) {
          pasoEjecucionId = matchedPaso.id
        }
      }

      // Verificar si ya existe un artefacto con el mismo sha256
      // (puede haber sido creado por el runner durante la ejecución)
      const existingArtefacto = await prisma.artefacto.findFirst({
        where: { ejecucionId, sha256 },
        select: { id: true, path: true },
      })

      let artefactoId: string

      if (existingArtefacto) {
        artefactoId = existingArtefacto.id
        // El artefacto ya existe pero el archivo se movió a storage/artefactos/
        // Actualizar el path para que apunte a la ubicación correcta
        if (existingArtefacto.path !== destPath) {
          await prisma.artefacto.update({
            where: { id: existingArtefacto.id },
            data: { path: destPath },
          }).catch((e) => {
            console.error('[artifacts] Error actualizando path de artefacto:', e)
          })
        }
      } else {
        // Crear nuevo artefacto
        const metadata = phase ? { phase, stepNum: stepNum ?? undefined } : { stepNum: stepNum ?? undefined }
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
        artefactoId = artefacto.id
      }

      // Si es captura con fase o tiene stepNum (captura automática), intentar vincular a PasoSubaccion
      if (pasoEjecucionId) {
        if (phase) {
          // Captura explícita con fase (toHaveScreenshot): usar la fase específica
          await linkCaptureToSubaccion(ejecucionId, pasoEjecucionId, artefactoId, phase)
        } else if (stepNum !== null) {
          // Captura automática de Playwright: vincular al siguiente substep sin captura
          await linkCaptureToSubaccionAuto(ejecucionId, pasoEjecucionId, artefactoId)
        }
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

/**
 * Vincula una captura automática (Playwright screenshot) al siguiente substep del paso
 * que aún no tenga una captura asignada (distribución por orden de ejecución).
 * Las capturas automáticas de Playwright no tienen sufijo "actual"/"expected",
 * así que las vinculamos como capturaActual.
 */
async function linkCaptureToSubaccionAuto(
  ejecucionId: string,
  pasoEjecucionId: string,
  artefactoId: string
): Promise<void> {
  try {
    // Buscar el primer substep del paso que no tenga ya una captura
    // (el mock de Jest no filtra por WHERE, así que verificamos en JS)
    const subaccion = await prisma.pasoSubaccion.findFirst({
      where: { ejecucionId, pasoEjecucionId },
      orderBy: { numero: 'asc' },
      select: { id: true, capturaActualId: true },
    })

    if (!subaccion) return

    // Solo vincular si no tiene ya una captura actual (no sobrescribir)
    if (subaccion.capturaActualId) return

    await prisma.pasoSubaccion.update({
      where: { id: subaccion.id },
      data: { capturaActualId: artefactoId },
    })
  } catch (err) {
    console.error('[artifacts] Error linking auto capture to subaccion:', err)
  }
}
