/**
 * GET /api/grabador/sesiones/[id]
 *
 * Devuelve el estado actual de una sesión (para rehidratación post-refresh).
 * Auth: requiere ser owner de la sesión (usuarioId = session.userId).
 *
 * Response 200: SesionEstado
 * Response 401: {error:'No autenticado'}
 * Response 403: {error:'forbidden'}
 * Response 404: {error:'not_found'}
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { SesionEstado } from "@/lib/grabador/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id },
    select: {
      id: true,
      usuarioId: true,
      estado: true,
      mensajeError: true,
      startedAt: true,
      endedAt: true,
    },
  });

  if (!sesion) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const out: SesionEstado = {
    id: sesion.id,
    estado: sesion.estado as SesionEstado["estado"],
    ...(sesion.mensajeError ? { mensajeError: sesion.mensajeError } : {}),
    ...(sesion.startedAt ? { startedAt: sesion.startedAt.toISOString() } : {}),
    ...(sesion.endedAt ? { endedAt: sesion.endedAt.toISOString() } : {}),
  };

  return NextResponse.json(out);
}