import { NextResponse } from 'next/server'
import { getEjecucionConPasos } from '@/lib/ejecuciones/queries'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const ejecucion = await getEjecucionConPasos(id)

  if (!ejecucion) {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  }

  return NextResponse.json({
    id: ejecucion.id,
    estado: ejecucion.estado,
    inicioAt: ejecucion.inicioAt,
    finAt: ejecucion.finAt,
    duracionMs: ejecucion.duracionMs,
    errorMsg: ejecucion.errorMsg,
    casoPruebaId: ejecucion.casoPrueba.id,
    casoPrueba: {
      nombre: ejecucion.casoPrueba.nombre,
      codigo: ejecucion.casoPrueba.codigo,
    },
    pasos: ejecucion.pasos.map(p => ({
      id: p.id,
      numero: p.numero,
      descripcion: p.descripcion,
      estado: p.estado,
      duracionMs: p.duracionMs,
      selfHealed: p.selfHealed,
      errorMsg: p.errorMsg,
      createdAt: p.createdAt,
    }))
  })
}
