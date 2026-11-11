/** POST: pausa una sesión activa (estado 'pausada'); no cierra el BrowserContext. */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

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

  // Idempotente: pausar una sesión ya pausada no hace nada.
  if (sesion.estado === "pausada") {
    return NextResponse.json({ ok: true, estado: "pausada", alreadyPaused: true });
  }

  if (sesion.estado !== "activa") {
    return NextResponse.json(
      {
        error: "session_not_active",
        message: `No se puede pausar una sesión en estado '${sesion.estado}'`,
      },
      { status: 400 },
    );
  }

  // No se guarda marca de pausa: resume calcula el tiempo con updatedAt.
  const pauseMarker = `PAUSE_AT:${Date.now()}`;
  await prisma.sesionGrabacion.update({
    where: { id },
    data: { estado: "pausada", mensajeError: pauseMarker },
  });

  return NextResponse.json({ ok: true, estado: "pausada" });
}
