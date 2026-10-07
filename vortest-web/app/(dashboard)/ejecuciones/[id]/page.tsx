import { migasDeProyecto } from '@/lib/migas'
import { tituloConAcceso } from "@/lib/metadata";
import { prisma } from "@/lib/db";
import type { Metadata } from "next";
import { getEjecucionConPasos } from '@/lib/ejecuciones/queries'
import { EjecucionDetalleClient } from '@/components/ejecuciones/ejecucion-detalle-client'
import { notFound, redirect } from 'next/navigation'
import { getSession, requireProyectoAccess, FORBIDDEN_ERROR } from '@/lib/auth'


export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const ej = await prisma.ejecucion.findUnique({ where: { id }, select: { casoPrueba: { select: { nombre: true, proyectoId: true } } } });
  return { title: await tituloConAcceso(ej?.casoPrueba.proyectoId, ej ? `Ejecución · ${ej.casoPrueba.nombre}` : undefined, "Ejecución") };
}
interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EjecucionDetallePage({ params }: PageProps) {
  const { id } = await params
  const ejecucion = await getEjecucionConPasos(id)

  if (!ejecucion) notFound()

  const session = await getSession()
  try {
    await requireProyectoAccess(session, ejecucion.casoPrueba.proyecto.id)
  } catch (err) {
    if (err === FORBIDDEN_ERROR) redirect('/ejecuciones')
    throw err
  }

  const migas = [
    ...(await migasDeProyecto(session, ejecucion.casoPrueba.proyecto)),
    { label: ejecucion.casoPrueba.nombre, href: `/casos/${ejecucion.casoPrueba.id}` },
    { label: `Ejecución ${id.slice(0, 8)}` },
  ]

  return (
    <EjecucionDetalleClient
      migas={migas}
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
          // HU-G17: exponer origen para que el chip pueda distinguir
          // casos del grabador vs. casos subidos como script.
          origen: ejecucion.casoPrueba.origen,
        },
        pasos: ejecucion.pasos.map(p => ({
          id: p.id,
          numero: p.numero,
          descripcion: p.descripcion,
          estado: p.estado,
          duracionMs: p.duracionMs,
          errorMsg: p.errorMsg,
          resultadoEsperado: p.resultadoEsperado,
          resultadoObtenido: p.resultadoObtenido,
          errorCount: p.errorCount,
          // HU-G18 — chapter timestamps del video.
          videoInicioMs: p.videoInicioMs,
          videoFinMs: p.videoFinMs,
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
