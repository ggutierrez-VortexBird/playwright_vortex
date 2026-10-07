/**
 * POST /api/ejecuciones/[id]/acta
 *
 * HU-G19 — Genera el PDF del acta de evidencia para una ejecución
 *   1) Lee la ejecución + caso + proyecto + espacio
 *   2) Calcula el siguiente consecutivo anual (tabla ConsecutivoAnual)
 *   3) Renderiza HTML con la plantilla (lib/acta/template.ts)
 *   4) Renderiza HTML → PDF con Playwright (lib/acta/render-pdf.ts)
 *   5) Persiste/actualiza la fila Acta (1-a-1 con ejecución)
 *   6) Devuelve { ok, actaId, consecutivo, pdfPath, downloadUrl }
 *
 * Auth: requiere acceso al proyecto de la ejecución (superadmin, admin del
 * espacio o tester asignado) — ver requireProyectoAccess más abajo.
 *
 * Idempotente: si ya existe un Acta para esta ejecución, regenera el PDF
 * con el mismo consecutivo (no incrementa el correlativo). El cliente
 * siempre obtiene el PDF más reciente.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireProyectoAccess,
  getSession,
  FORBIDDEN_ERROR,
  NOT_FOUND_ERROR,
  type SessionData,
} from "@/lib/auth";
import { renderActaHTML } from "@/lib/acta/template";
import { nextActaConsecutivo, renderActaToPdf } from "@/lib/acta/render-pdf";
import type { ActaTemplateEjecucion } from "@/lib/acta/types";
import { conCandado } from "@/lib/candado";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
// El render con Playwright puede tardar 2-3s en frío (lanzar Chromium).
export const maxDuration = 60;

export async function POST(_request: Request, { params }: RouteParams) {
  const session: SessionData = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const ejecucion = await prisma.ejecucion.findUnique({
    where: { id },
    include: {
      casoPrueba: {
        include: {
          proyecto: { include: { espacio: true } },
        },
      },
      pasos: { orderBy: { numero: "asc" } },
    },
  });

  if (!ejecucion) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await requireProyectoAccess(session, ejecucion.casoPrueba.proyectoId);
  } catch (err) {
    // Comparamos por identidad Y por mensaje porque en tests se mockea
    // @/lib/auth y el FORBIDDEN_ERROR mockeado es una instancia distinta
    // del real (pero ambos tienen el mismo mensaje).
    if (err === FORBIDDEN_ERROR || (err as { message?: string })?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    throw err;
  }

  // Mapear a la shape de la plantilla (string fechas ya convertidas).
  const ejecucionTemplate: ActaTemplateEjecucion = {
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
    casoPrueba: {
      nombre: ejecucion.casoPrueba.nombre,
      codigo: ejecucion.casoPrueba.codigo,
      origen: ejecucion.casoPrueba.origen,
      proyecto: {
        nombre: ejecucion.casoPrueba.proyecto.nombre,
        ambiente: ejecucion.casoPrueba.proyecto.ambiente,
        espacio: {
          nombre: ejecucion.casoPrueba.proyecto.espacio.nombre,
        },
      },
    },
    pasos: ejecucion.pasos.map((p) => ({
      numero: p.numero,
      descripcion: p.descripcion,
      estado: p.estado,
      duracionMs: p.duracionMs,
      errorMsg: p.errorMsg,
    })),
  };

  // De a una por ejecución: dos "Generar acta" simultáneos no consumen dos consecutivos.
  return conCandado(`acta:${id}`, async () => {
    const actaExistente = await prisma.acta.findUnique({
      where: { ejecucionId: id },
    });

    const consecutivo = actaExistente
      ? actaExistente.consecutivo
      : (await nextActaConsecutivo(prisma)).consecutivo;

    const generadoEn = new Date();
    const html = renderActaHTML({ ejecucion: ejecucionTemplate, actaConsecutivo: consecutivo, generadoEn });

    let pdfPath: string;
    try {
      pdfPath = (await renderActaToPdf({ templateHtml: html, consecutivo })).pdfPath;
    } catch (err) {
      console.error("[acta] Error renderizando PDF", err);
      return NextResponse.json(
        { error: "render_failed", message: "No se pudo generar el PDF del acta. Intenta de nuevo en unos segundos." },
        { status: 500 },
      );
    }

    let acta;
    let consecutivoFinal = consecutivo;
    try {
      acta = actaExistente
        ? await prisma.acta.update({
            where: { id: actaExistente.id },
            data: { rutaPdf: pdfPath, generatedAt: generadoEn },
          })
        : await prisma.acta.create({
            data: { ejecucionId: id, consecutivo, rutaPdf: pdfPath, generatedAt: generadoEn },
          });
    } catch (err) {
      // Otra instancia ganó la carrera (ejecucionId es único): se devuelve el acta que quedó.
      const ganadora = (err as { code?: string })?.code === "P2002" ? await prisma.acta.findUnique({ where: { ejecucionId: id } }) : null;
      if (!ganadora) throw err;
      acta = ganadora;
      consecutivoFinal = ganadora.consecutivo;
    }

    // Sin rutas del servidor en la respuesta: el cliente descarga por downloadUrl.
    return NextResponse.json({
      ok: true,
      actaId: acta.id,
      consecutivo: consecutivoFinal,
      downloadUrl: `/api/actas/${acta.id}/download`,
    });
  });
}
