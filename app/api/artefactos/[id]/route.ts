import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
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
  })

  if (!artefacto) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  if (!fs.existsSync(artefacto.path)) {
    return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 })
  }

  const contentType = CONTENT_TYPE_MAP[artefacto.tipo] || 'application/octet-stream'

  const stream = fs.createReadStream(artefacto.path)

  return new Response(stream as any, {
    status: 200,
    headers: {
      'Content-Type': contentType,
    },
  })
}
