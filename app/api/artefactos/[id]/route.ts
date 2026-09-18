import { NextResponse } from 'next/server'
import { getSession, requireProyectoAccess, FORBIDDEN_ERROR } from '@/lib/auth'
import { prisma } from '@/lib/db'
import * as fs from 'fs'

export const dynamic = 'force-dynamic'

const CONTENT_TYPE_MAP: Record<string, string> = {
  video: 'video/webm',
  captura: 'image/png',
  trace: 'application/json',
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session.userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const artefacto = await prisma.artefacto.findUnique({
    where: { id },
    include: { ejecucion: { select: { casoPrueba: { select: { proyectoId: true } } } } },
  })

  if (!artefacto) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  try {
    await requireProyectoAccess(session, artefacto.ejecucion.casoPrueba.proyectoId)
  } catch (err) {
    if (err === FORBIDDEN_ERROR || (err as { message?: string })?.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }
    throw err
  }

  if (!fs.existsSync(artefacto.path)) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  const contentType = CONTENT_TYPE_MAP[artefacto.tipo] || 'application/octet-stream'

  const stream = fs.createReadStream(artefacto.path)

  // Node's fs.ReadStream doesn't structurally match the web ReadableStream
  // type Response expects; `unknown` makes the cast explicit instead of `any`.
  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
    },
  })
}
