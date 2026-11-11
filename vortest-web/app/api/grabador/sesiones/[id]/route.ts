/** GET estado de la sesión, PATCH la detiene o descarta, DELETE la elimina en cascada. Solo el dueño. */
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

/** PATCH: cambia el estado a 'detenida' o 'descartada'; idempotente si ya es terminal. */
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

  // 'descartada': borrado en cascada (el WS ya cerró en el cliente).
  if (estado === "descartada") {
    await prisma.sesionGrabacion.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  // 'detenida': marca endedAt; si ya es terminal no se vuelve a tocar.
  if (sesion.estado === "detenida" || sesion.estado === "descartada") {
    return NextResponse.json({ ok: true, alreadyTerminal: true });
  }

  await prisma.sesionGrabacion.update({
    where: { id },
    data: { estado: "detenida", endedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}

/** DELETE: elimina la sesión y sus pasos en cascada (equivale a PATCH 'descartada'). */
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