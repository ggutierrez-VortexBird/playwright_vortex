/**
 * POST /api/grabador/sesiones/[id]/reanudar
 *
 * Reactiva una sesión detenida para continuar grabando. El BrowserContext
 * del recorder-worker sigue vivo en memoria (HU-G22: solo se cierra en
 * 'descartada' o heartbeat timeout), así que el usuario vuelve a la vista
 * EN VIVO y los pasos siguen agregándose.
 *
 * Auth: requiere ser owner.
 *
 * Responses:
 *   - 200 { ok: true, estado: 'activa' }
 *   - 400 { error: 'cannot_resume', message } (estado no permite reanudar)
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

const ESTADOS_REANUDABLES = new Set(["detenida", "pausada"]);

export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id },
    select: { id: true, usuarioId: true, estado: true, mensajeError: true },
  });

  if (!sesion) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // 'pausada' can also resume (used by the pause button toggle flow when
  // the user navigates away and back).
  if (!ESTADOS_REANUDABLES.has(sesion.estado)) {
    return NextResponse.json(
      {
        error: "cannot_resume",
        message: `No se puede reanudar una sesión en estado '${sesion.estado}'`,
      },
      { status: 400 },
    );
  }

  await prisma.sesionGrabacion.update({
    where: { id },
    data: { estado: "activa", endedAt: null, mensajeError: null },
  });

  return NextResponse.json({ ok: true, estado: "activa" });
}
