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
      origen: ejecucion.casoPrueba.origen, // HU-G17: exponer origen para chip
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
      // HU-G18 — chapter timestamps for the segmented video bar.
      videoInicioMs: p.videoInicioMs,
      videoFinMs: p.videoFinMs,
      logs: p.logs,
      createdAt: p.createdAt,
      subacciones: (p.subacciones ?? []).map(s => ({
        id: s.id,
        numero: s.numero,
        descripcion: s.descripcion,
        estado: s.estado,
        duracionMs: s.duracionMs,
        tipo: s.tipo,
        errorMsg: s.errorMsg,
        logs: s.logs,
        capturaActual: s.capturaActual ? {
          id: s.capturaActual.id,
          tipo: s.capturaActual.tipo,
          nombre: s.capturaActual.nombre,
          bytes: s.capturaActual.bytes,
        } : null,
        capturaReferencia: s.capturaReferencia ? {
          id: s.capturaReferencia.id,
          tipo: s.capturaReferencia.tipo,
          nombre: s.capturaReferencia.nombre,
          bytes: s.capturaReferencia.bytes,
        } : null,
      })),
    })),
    artefactos: ejecucion.artefactos.map(a => ({
      id: a.id,
      tipo: a.tipo,
      nombre: a.nombre,
      pasoEjecucionId: a.pasoEjecucionId,
      bytes: a.bytes,
      createdAt: a.createdAt,
    })),
    // HU-G19 — acta ya generada (si existe)
    acta: ejecucion.acta
      ? {
          id: ejecucion.acta.id,
          consecutivo: ejecucion.acta.consecutivo,
          rutaPdf: ejecucion.acta.rutaPdf,
        }
      : null,
  })
}
