/**
 * POST /api/grabador/sesiones/[id]/pause
 *
 * Pausa una sesión activa. Cambia el estado a 'pausada' para que la
 * UI muestre "Pausado" en el cronómetro. NO cierra el BrowserContext.
 *
 * En este PR la pausa lógica (DB) corre en paralelo a la pausa UI (WS
 * message). El WS-server ya tiene un handler para {type:'pause'} que
 * cambia el flag de emisión de pasos. Este endpoint complementa la
 * persistencia en DB para que reload de la página muestre el estado
 * correcto.
 *
 * Auth: requiere ser owner.
 *
 * Responses:
 *   - 200 { ok: true, estado: 'pausada' }
 *   - 400 { error: 'session_not_active' } (estado != 'activa')
 *   - 401 { error: 'No autenticado' }
 *   - 403 { error: 'forbidden' }
 *   - 404 { error: 'not_found' }
 */

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

  // Idempotent: pausing an already-paused session is a no-op.
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

  // Record pause timestamp in `mensajeError` field as a JSON marker so we
  // can detect >5s pause on resume without adding a column. Format:
  //   "PAUSE_AT:<epochMs>"
  // This is a defensive hack — a real implementation would add a column.
  // For PR-3 we just leave the message untouched; resume endpoint reads
  // `updatedAt` and computes elapsed.
  const pauseMarker = `PAUSE_AT:${Date.now()}`;
  await prisma.sesionGrabacion.update({
    where: { id },
    data: { estado: "pausada", mensajeError: pauseMarker },
  });

  return NextResponse.json({ ok: true, estado: "pausada" });
}
