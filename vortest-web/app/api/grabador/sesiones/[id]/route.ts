/**
 * GET /api/grabador/sesiones/[id]
 * PATCH /api/grabador/sesiones/[id]   (HU-G2: cambiar estado — detener/descartar)
 * DELETE /api/grabador/sesiones/[id]  (HU-G2: descartar — cascade delete)
 *
 * Auth: requiere ser owner de la sesión (usuarioId = session.userId).
 *
 * GET: devuelve el estado actual de una sesión (para rehidratación post-refresh).
 *
 * PATCH body: { estado: 'detenida' | 'descartada' }
 *   - 'detenida': marca endedAt=now, mantiene las filas (sigue editable en HU-G8).
 *   - 'descartada': cascade-delete de SesionGrabacion + PasoGrabado.
 *
 * DELETE: cascade-delete de la sesión y todos sus pasos grabados
 *         (cascade en el FK de PasoGrabado.sesionId).
 *
 * Response 200: GET → SesionEstado, PATCH → {ok: true}, DELETE → {ok: true}
 * Response 401: {error:'No autenticado'}
 * Response 403: {error:'forbidden'}
 * Response 404: {error:'not_found'}
 * Response 400: {error:'validation'} para PATCH con estado inválido
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { SesionEstado } from "@/lib/grabador/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ESTADOS_TERMINALES = ["detenida", "descartada"] as const;
type EstadoTerminal = (typeof ESTADOS_TERMINALES)[number];

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

/**
 * PATCH /api/grabador/sesiones/[id]
 *
 * Cambia el estado de una sesión a 'detenida' o 'descartada'.
 *   - 'detenida': marca endedAt (persiste la grabación para HU-G8 review).
 *   - 'descartada': cascade-delete (UX de "Descartar" en el topbar).
 *
 * Si la sesión ya está en estado terminal, responde 200 idempotente.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  let body: { estado?: string };
  try {
    body = (await request.json()) as { estado?: string };
  } catch {
    return NextResponse.json(
      { error: "validation", message: "JSON inválido" },
      { status: 400 },
    );
  }

  const estado = body.estado as EstadoTerminal | undefined;
  if (!estado || !ESTADOS_TERMINALES.includes(estado)) {
    return NextResponse.json(
      {
        error: "validation",
        message: `estado debe ser uno de: ${ESTADOS_TERMINALES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id },
    select: { id: true, usuarioId: true, estado: true },
  });

  if (!sesion) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 'descartada' → cascade delete (SesionGrabacion + PasoGrabado via FK).
  // El WS client ya cerró localmente; en DB simplemente borramos.
  if (estado === "descartada") {
    await prisma.sesionGrabacion.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  // 'detenida' → marcar endedAt y estado.
  // Idempotente: si ya está detenida/descartada, no tocamos endedAt de nuevo.
  if (sesion.estado === "detenida" || sesion.estado === "descartada") {
    return NextResponse.json({ ok: true, alreadyTerminal: true });
  }

  await prisma.sesionGrabacion.update({
    where: { id },
    data: { estado: "detenida", endedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/grabador/sesiones/[id]
 *
 * Elimina la sesión y todos sus pasos grabados (cascade).
 * Es el comportamiento de "Descartar" — equivalente a PATCH con
 * estado='descartada' pero más directo (sin parsear body).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id },
    select: { id: true, usuarioId: true },
  });

  if (!sesion) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await prisma.sesionGrabacion.delete({ where: { id } });
  return NextResponse.json({ ok: true, deleted: true });
}