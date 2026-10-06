/**
 * POST /api/internal/artefactos/upload
 *
 * Único endpoint HTTP entrante que vortest-engine llama directamente (fuera
 * de RabbitMQ) — sube cada artefacto (video/captura/trace) apenas termina de
 * generarlo, streamed, multipart. Ver vortest-engine/src/artifacts/artifacts.service.ts
 * para el cliente exacto que arma este POST.
 *
 * Auth: `secretoValido` (constant-time, lib/security/secret.ts) contra `X-Internal-Secret`; 401 `{error:'unauthorized'}` si falta o no matchea.
 *
 * Body (multipart/form-data):
 *   ejecucionId, fileName, tipo ('video'|'captura'|'trace'), sha256, bytes,
 *   metadata? (JSON string), file (binario)
 *
 * Responses:
 *   200 { artefactoId, deduplicated }
 *   400 { error: 'validation' | 'invalid_multipart', message? }
 *   401 { error: 'unauthorized' }
 *   500 { error: 'write_failed' | 'internal' }
 */
import { NextRequest, NextResponse } from 'next/server'
import * as fs from 'fs'
// Import por default (no destructurado) a propósito: es el mismo patrón que
// el resto del repo usa para `fs/promises` porque `jest.mock('fs/promises', factory)`
// no intercepta consistentemente named imports bajo el transform de
// next/jest — el mock testeable es sobre `fsPromises.default` (ver
// __tests__/app/api/internal/artefactos/upload/route.test.ts).
import fsPromises from 'fs/promises'
import * as path from 'path'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { ReadableStream as WebReadableStream } from 'stream/web'
import { ensureArtefacto } from '@/lib/worker/artifacts'
import type { ArtefactoTipo, Prisma } from '@prisma/client'
import { secretoValido } from '@/lib/security/secret'
import { prisma } from '@/lib/db'

// Necesita `fs` real (streaming a disco local) — no puede correr en el
// runtime Edge.
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

  // SEG-08: validar formato UUID y existencia de la ejecucion antes de tocar disco
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

  // path.basename evita path traversal si fileName llegara con "../" — mismo
  // destino que antes (storage/artefactos/<ejecucionId>/<fileName>), solo
  // que ahora llega por HTTP en vez de fs.renameSync local.
  const sanitizedFileName = path.basename(fileName)
  const storageDir = path.resolve(process.cwd(), 'storage', 'artefactos', ejecucionId)
  const destPath = path.join(storageDir, sanitizedFileName)

  try {
    await fsPromises.mkdir(storageDir, { recursive: true })
    // File -> disco vía streaming: `file.stream()` (Web ReadableStream) se
    // adapta con Readable.fromWeb y se conecta a fs.createWriteStream con
    // pipeline — de acá en más nunca se materializa el archivo completo en
    // un Buffer/string propio de esta ruta. IMPORTANTE (honestidad sobre la
    // garantía real): la llamada `request.formData()` de más arriba ya hizo
    // el parseo completo del multipart entrante usando la implementación
    // nativa de Next.js/undici, que construye cada parte (incluida `file`)
    // como un Blob en memoria ANTES de que este handler pueda leer nada —
    // es decir, el body completo ya fue bufferizado una vez por el runtime
    // antes de llegar acá. Lo que este código evita es un SEGUNDO buffer
    // completo propio (no hacemos `await file.arrayBuffer()` + `writeFile`);
    // no puede evitar el primero, porque la App Router de Next.js no expone
    // hoy una API de multipart verdaderamente streaming de punta a punta.
    const webStream = file.stream() as unknown as WebReadableStream<Uint8Array>
    const nodeStream = Readable.fromWeb(webStream)
    await pipeline(nodeStream, fs.createWriteStream(destPath))
  } catch (err) {
    console.error('[upload] Error escribiendo artefacto a disco:', err)
    return NextResponse.json({ error: 'write_failed' }, { status: 500 })
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
