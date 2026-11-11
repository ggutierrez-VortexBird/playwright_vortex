/** POST: heartbeat HTTP de respaldo al WS; mantiene viva la sesión y devuelve el TTL restante. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** TTL de heartbeat en segundos (10 min, alineado con RECORDER_HEARTBEAT_TIMEOUT_MS). */
export const HEARTBEAT_TTL_SEC = 600;

export async function POST(_request: Request, { params }: RouteParams) {
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
      updatedAt: true,
    },
  });

  if (!sesion) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (sesion.estado !== "activa") {
    return NextResponse.json(
      { error: "session_not_active" },
      { status: 409 },
    );
  }

  // Refresca updatedAt para que cleanupOrphans no elimine la sesión.
  await prisma.sesionGrabacion.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, ttl: HEARTBEAT_TTL_SEC });
}
