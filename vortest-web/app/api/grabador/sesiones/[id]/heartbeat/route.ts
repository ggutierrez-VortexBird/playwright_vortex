/**
 * POST /api/grabador/sesiones/[id]/heartbeat
 *
 * Heartbeat HTTP desde el cliente Next.js al recorder-worker.
 *
 * El browser-side heartbeats via WS (mensaje {type:'heartbeat'}) son la
 * fuente primaria — el recorder-worker usa esos para expirar sesiones
 * inactivas. Este endpoint HTTP es un fallback para casos en los que:
 *   - El WS está caído pero el cliente aún tiene la sesión activa.
 *   - Se necesita extender el TTL desde el server (futuro).
 *
 * Comportamiento:
 *   - Auth: requiere ser owner de la sesión (usuarioId = session.userId).
 *   - Si la sesión está en estado='activa', actualiza `updatedAt` (lo que
 *     mantiene viva la fila para `cleanupOrphans`).
 *   - Devuelve `{ok: true, ttl: <segundos>}` con el TTL restante hasta
 *     que el heartbeat expire (10 min = 600s).
 *
 * Responses:
 *   - 200: {ok: true, ttl: 600}
 *   - 401: {error: 'No autenticado'}
 *   - 403: {error: 'forbidden'}
 *   - 404: {error: 'not_found'}
 *   - 409: {error: 'session_not_active'}  (estado != 'activa')
 */
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

  // Refresh updatedAt so cleanupOrphans (which checks updatedAt < now-5min)
  // doesn't reap the session while the user is still recording.
  await prisma.sesionGrabacion.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, ttl: HEARTBEAT_TTL_SEC });
}
