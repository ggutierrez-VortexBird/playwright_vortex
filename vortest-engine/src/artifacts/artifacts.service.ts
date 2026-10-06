// src/artifacts/artifacts.service.ts
// Escanea el directorio de salida de Playwright, computa SHA256 (streamed,
// nunca bufferiza el archivo completo), y sube cada artefacto por HTTP
// (multipart, streamed) a vortest-web. Mirror del escaneo/heurística de
// vortest-web/lib/worker/artifacts.ts — SIN la mitad de vinculación a DB
// (eso se queda en el handler de upload de vortest-web, que recibe
// `ejecucionId` + `metadata` y decide cómo linkear a PasoEjecucion/
// PasoSubaccion).
import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import FormData from 'form-data'
import { firstValueFrom } from 'rxjs'
import type { CollectedArtifactRef } from '../queue/events.publisher'

export type ArtefactoTipo = 'video' | 'captura' | 'trace'

export interface UploadArtifactParams {
  jobId: string
  filePath: string
  fileName: string
  tipo: ArtefactoTipo
  metadata?: { phase?: string; stepNum?: number }
}

export interface UploadArtifactResult {
  artefactoId: string
  deduplicated: boolean
}

const MAX_UPLOAD_ATTEMPTS = 3
const BACKOFF_BASE_MS = 1000

async function sha256AndSize(filePath: string): Promise<{ sha256: string; bytes: number }> {
  const hash = crypto.createHash('sha256')
  let bytes = 0
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk: string | Buffer) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk, 'utf-8') : chunk
      bytes += buf.length
      hash.update(buf)
    })
    stream.on('end', () => resolve())
    stream.on('error', reject)
  })
  return { sha256: hash.digest('hex'), bytes }
}

function detectPhase(fileName: string): 'captura-actual' | 'captura-referencia' | null {
  const lower = fileName.toLowerCase()
  if (lower.includes('actual')) return 'captura-actual'
  if (lower.includes('reference') || lower.includes('expected')) return 'captura-referencia'
  return null
}

/**
 * Heurística de matching por nombre de archivo, idéntica a
 * vortest-web/lib/worker/artifacts.ts: "step-N" (naming manual) o
 * "...-N.png" (screenshots automáticos de Playwright).
 */
function detectStepNum(fileName: string): number | null {
  const stepMatch = fileName.match(/^step-(\d+)/i)
  if (stepMatch) return parseInt(stepMatch[1], 10)
  const autoMatch = fileName.match(/-(\d+)\.png$/i)
  if (autoMatch) return parseInt(autoMatch[1], 10)
  return null
}

@Injectable()
export class ArtifactsService {
  private readonly logger = new Logger(ArtifactsService.name)

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sube un único artefacto con reintentos acotados (3 intentos, backoff
   * exponencial 1s/2s). Cada intento reconstruye el FormData/ReadStream
   * porque un stream ya consumido no se puede reenviar. Retorna null si
   * todos los intentos fallan — el caller decide qué hacer (marcar
   * `artifactUploadFailed`, no crashear el job entero).
   */
  async uploadArtifact(params: UploadArtifactParams): Promise<UploadArtifactResult | null> {
    const { jobId, filePath, fileName, tipo, metadata } = params

    let sha256: string
    let bytes: number
    try {
      const hashed = await sha256AndSize(filePath)
      sha256 = hashed.sha256
      bytes = hashed.bytes
    } catch (err) {
      this.logger.error(`No se pudo hashear ${filePath}: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }

    const baseUrl = this.config.getOrThrow<string>('MAIN_APP_INTERNAL_URL')
    const secret = this.config.getOrThrow<string>('ENGINE_INTERNAL_SECRET')
    const url = `${baseUrl.replace(/\/$/, '')}/api/internal/artefactos/upload`

    for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
      try {
        const form = new FormData()
        form.append('ejecucionId', jobId)
        form.append('fileName', fileName)
        form.append('tipo', tipo)
        form.append('sha256', sha256)
        form.append('bytes', String(bytes))
        if (metadata) form.append('metadata', JSON.stringify(metadata))
        form.append('file', fs.createReadStream(filePath), fileName)

        const response = await firstValueFrom(
          this.http.post<UploadArtifactResult>(url, form, {
            headers: {
              ...form.getHeaders(),
              'X-Internal-Secret': secret,
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          }),
        )
        return response.data
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        this.logger.warn(
          `Intento ${attempt}/${MAX_UPLOAD_ATTEMPTS} fallido subiendo ${fileName} (job ${jobId}): ${message}`,
        )
        if (attempt === MAX_UPLOAD_ATTEMPTS) {
          this.logger.error(`Agotados los reintentos subiendo ${fileName} (job ${jobId})`)
          return null
        }
        await new Promise((resolve) => setTimeout(resolve, BACKOFF_BASE_MS * 2 ** (attempt - 1)))
      }
    }
    return null
  }

  /**
   * Barrido post-ejecución del outputDir de Playwright — captura sobre todo
   * el video (nunca referenciado por ningún evento en tiempo real) y
   * cualquier screenshot automático que el runner no haya subido ya vía
   * substep/captura-test (se re-sube igual: el endpoint de vortest-web
   * dedupea por sha256+ejecucionId y devuelve el mismo artefactoId).
   *
   * `totalSteps` reemplaza la consulta a `prisma.pasoEjecucion.findMany` del
   * original — el motor no tiene DB, así que valida el heurístico de
   * stepNum contra el conteo de pasos que efectivamente emitió el runner
   * en esta misma corrida, en vez de contra filas persistidas.
   */
  async collectAndUploadArtifacts(
    jobId: string,
    outputDir: string,
    totalSteps: number,
  ): Promise<{ artefactos: CollectedArtifactRef[]; anyFailed: boolean }> {
    let entries: string[] = []
    try {
      entries = fs.readdirSync(outputDir)
    } catch {
      this.logger.warn(`No se encontró outputDir ${outputDir} — nada que recolectar`)
      return { artefactos: [], anyFailed: false }
    }

    const candidatePaths: string[] = []
    for (const entry of entries) {
      const entryPath = path.join(outputDir, entry)
      let stat: fs.Stats
      try {
        stat = fs.statSync(entryPath)
      } catch {
        continue
      }

      if (stat.isDirectory()) {
        try {
          for (const subFile of fs.readdirSync(entryPath)) {
            if ((subFile.startsWith('video') && subFile.endsWith('.webm')) || subFile.endsWith('.png') || subFile.endsWith('.zip')) {
              candidatePaths.push(path.join(entryPath, subFile))
            }
          }
        } catch {
          // Error al leer subdirectorio — continuar
        }
      } else if ((entry.startsWith('video') && entry.endsWith('.webm')) || entry.endsWith('.png') || entry.endsWith('.zip')) {
        candidatePaths.push(entryPath)
      }
    }

    const artefactos: CollectedArtifactRef[] = []
    let anyFailed = false

    for (const filePath of candidatePaths) {
      const fileName = path.basename(filePath)
      const tipo: ArtefactoTipo = fileName.endsWith('.webm') ? 'video' : fileName.endsWith('.zip') ? 'trace' : 'captura'
      const phase = detectPhase(fileName)
      let stepNum = detectStepNum(fileName)
      if (stepNum !== null && (stepNum < 1 || stepNum > totalSteps)) {
        stepNum = null
      }

      const metadata = phase ? { phase, stepNum: stepNum ?? undefined } : { stepNum: stepNum ?? undefined }
      const result = await this.uploadArtifact({ jobId, filePath, fileName, tipo, metadata })

      if (!result) {
        anyFailed = true
        continue
      }

      artefactos.push({
        fileName,
        artefactoId: result.artefactoId,
        tipo,
        pasoNumero: stepNum,
        phase,
      })
    }

    return { artefactos, anyFailed }
  }
}
