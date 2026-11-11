/** POST: recibe cada artefacto del motor (multipart) y lo guarda en disco; auth por X-Internal-Secret. */
import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
// Import por default: jest.mock('fs/promises') no intercepta de forma consistente los named imports.
import fsPromises from 'fs/promises'
import * as path from 'path'
import { createHash } from 'crypto'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import type { ReadableStream as WebReadableStream } from 'stream/web'
import { ensureArtefacto } from '@/lib/worker/artifacts'
import type { ArtefactoTipo, Prisma } from '@prisma/client'
import { secretoValido } from '@/lib/security/secret'
import { prisma } from '@/lib/db'

// Necesita fs real: no corre en el runtime Edge.
export const runtime = 'nodejs'

const VALID_TIPOS = new Set<string>(['video', 'captura', 'trace'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = request.headers.get('x-internal-secret')
  const expected = process.env.ENGINE_INTERNAL_SECRET
  if (!secretoValido(secret, expected ?? '')) {
    return unauthorized()
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch (err) {
    console.error('[upload] Error parseando multipart:', err)
    return NextResponse.json({ error: 'invalid_multipart' }, { status: 400 })
  }

  const ejecucionId = form.get('ejecucionId')
  const fileName = form.get('fileName')
  const tipo = form.get('tipo')
  const sha256 = form.get('sha256')
  const bytesRaw = form.get('bytes')
  const metadataRaw = form.get('metadata')
  const file = form.get('file')

  if (
    typeof ejecucionId !== 'string' ||
    typeof fileName !== 'string' ||
    typeof tipo !== 'string' ||
    typeof sha256 !== 'string' ||
    typeof bytesRaw !== 'string' ||
    !(file instanceof File)
  ) {
    return NextResponse.json(
      {
        error: 'validation',
        message: 'Campos requeridos: ejecucionId, fileName, tipo, sha256, bytes, file',
      },
      { status: 400 }
    )
  }

  if (!VALID_TIPOS.has(tipo)) {
    return NextResponse.json({ error: 'validation', message: `tipo inválido: ${tipo}` }, { status: 400 })
  }

  // Valida el UUID y la existencia de la ejecución antes de tocar disco.
  if (!UUID_RE.test(ejecucionId)) {
    return NextResponse.json({ error: 'validation', message: 'ejecucionId inválido' }, { status: 400 })
  }
  const ejecucion = await prisma.ejecucion.findUnique({ where: { id: ejecucionId }, select: { id: true } })
  if (!ejecucion) {
    return NextResponse.json({ error: 'validation', message: 'ejecucion no encontrada' }, { status: 404 })
  }

  const bytes = Number.parseInt(bytesRaw, 10)
  if (!Number.isFinite(bytes) || bytes < 0) {
    return NextResponse.json({ error: 'validation', message: 'bytes inválido' }, { status: 400 })
  }

  let metadata: Record<string, unknown> | undefined
  if (typeof metadataRaw === 'string' && metadataRaw.length > 0) {
    try {
      metadata = JSON.parse(metadataRaw) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: 'validation', message: 'metadata no es JSON válido' }, { status: 400 })
    }
  }

  // path.basename evita path traversal si fileName trae "../".
  const sanitizedFileName = path.basename(fileName)
  if (!/^[0-9a-f]{64}$/i.test(sha256)) {
    return NextResponse.json({ error: 'validation', message: 'sha256 inválido' }, { status: 400 })
  }
  const storageDir = path.resolve(process.cwd(), 'storage', 'artefactos', ejecucionId)
  // Prefijo con el hash: los video.webm de un mismo spec se pisaban; `nombre` conserva el original.
  const destPath = path.join(storageDir, `${sha256.slice(0, 12).toLowerCase()}-${sanitizedFileName}`)
  const hash = createHash('sha256')
  let bytesEscritos = 0
  const verificador = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk)
      bytesEscritos += chunk.length
      callback(null, chunk)
    },
  })

  try {
    await fsPromises.mkdir(storageDir, { recursive: true })
    // Streaming a disco con Readable.fromWeb + pipeline; request.formData() ya bufferizó el body, esto solo evita un segundo buffer.
    const webStream = file.stream() as unknown as WebReadableStream<Uint8Array>
    const nodeStream = Readable.fromWeb(webStream)
    await pipeline(nodeStream, verificador, fs.createWriteStream(destPath))
  } catch (err) {
    console.error('[upload] Error escribiendo artefacto a disco:', err)
    return NextResponse.json({ error: 'write_failed' }, { status: 500 })
  }

  if (hash.digest('hex') !== sha256.toLowerCase() || bytesEscritos !== bytes) {
    await fsPromises.rm(destPath, { force: true })
    console.error(`[upload] ${sanitizedFileName}: hash o tamaño no coinciden (${bytesEscritos} de ${bytes} bytes)`)
    return NextResponse.json({ error: 'validation', message: 'El archivo recibido no coincide con su hash o tamaño' }, { status: 400 })
  }

  try {
    const result = await ensureArtefacto({
      ejecucionId,
      tipo: tipo as ArtefactoTipo,
      nombre: sanitizedFileName,
      path: destPath,
      sha256,
      bytes,
      metadata: metadata as Prisma.InputJsonValue | undefined,
    })
    return NextResponse.json({ artefactoId: result.artefactoId, deduplicated: result.deduplicated })
  } catch (err) {
    console.error('[upload] Error creando Artefacto:', err)
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
