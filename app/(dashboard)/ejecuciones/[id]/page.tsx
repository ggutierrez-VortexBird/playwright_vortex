import { getEjecucionConPasos } from '@/lib/ejecuciones/queries'
import { EjecucionDetalleClient } from '@/components/ejecuciones/ejecucion-detalle-client'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EjecucionDetallePage({ params }: PageProps) {
  const { id } = await params
  const ejecucion = await getEjecucionConPasos(id)

  if (!ejecucion) notFound()

  return (
    <EjecucionDetalleClient
      ejecucionId={id}
      initialEjecucion={{
        id: ejecucion.id,
        estado: ejecucion.estado,
        inicioAt: ejecucion.inicioAt ? ejecucion.inicioAt.toISOString() : null,
        finAt: ejecucion.finAt ? ejecucion.finAt.toISOString() : null,
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
          createdAt: p.createdAt.toISOString(),
        })),
        artefactos: ejecucion.artefactos.map(a => ({
          id: a.id,
          tipo: a.tipo,
          nombre: a.nombre,
          pasoEjecucionId: a.pasoEjecucionId,
          bytes: a.bytes,
          createdAt: a.createdAt.toISOString(),
        })),
      }}
    />
  )
}
