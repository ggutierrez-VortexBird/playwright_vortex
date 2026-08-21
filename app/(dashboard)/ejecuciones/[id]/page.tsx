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
        entorno: ejecucion.entorno,
        navegador: ejecucion.navegador,
        sistemaOperativo: ejecucion.sistemaOperativo,
        nodoEjecucion: ejecucion.nodoEjecucion,
        asercionesTotal: ejecucion.asercionesTotal,
        asercionesOk: ejecucion.asercionesOk,
        asercionesFail: ejecucion.asercionesFail,
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
          resultadoEsperado: p.resultadoEsperado,
          resultadoObtenido: p.resultadoObtenido,
          errorCount: p.errorCount,
          logs: p.logs,
          createdAt: p.createdAt.toISOString(),
          subacciones: p.subacciones.map(s => ({
            id: s.id,
            numero: s.numero,
            descripcion: s.descripcion,
            estado: s.estado,
            duracionMs: s.duracionMs,
            tipo: s.tipo,
            errorMsg: s.errorMsg,
            logs: s.logs,
            capturaActual: s.capturaActual
              ? { id: s.capturaActual.id, tipo: s.capturaActual.tipo, nombre: s.capturaActual.nombre, bytes: s.capturaActual.bytes }
              : null,
            capturaReferencia: s.capturaReferencia
              ? { id: s.capturaReferencia.id, tipo: s.capturaReferencia.tipo, nombre: s.capturaReferencia.nombre, bytes: s.capturaReferencia.bytes }
              : null,
          })),
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
