/**
 * POST /api/grabador/sesiones/[id]/resume
 *
 * Reanuda una sesión pausada. Si la pausa duró >5s, inserta un paso
 * "Esperar «pausa»" con origen='auto' (HU-G7 acceptance criteria).
 *
 * Auth: requiere ser owner.
 *
 * Responses:
 *   - 200 { ok: true, estado: 'activa', autoEsperaCreada: boolean }
 *   - 400 { error: 'not_paused' }
 *   - 401 { error: 'No autenticado' }
 *   - 403 { error: 'forbidden' }
 *   - 404 { error: 'not_found' }
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Umbral en ms para considerar la pausa como "larga" y crear auto-espera. */
export const PAUSE_AUTO_WAIT_THRESHOLD_MS = 5_000;

function parsePauseMarker(mensajeError: string | null): number | null {
  if (!mensajeError) return null;
  const match = mensajeError.match(/^PAUSE_AT:(\d+)$/);
  if (!match) return null;
  return Number.parseInt(match[1] ?? "", 10);
}

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
  if (sesion.estado !== "pausada") {
    return NextResponse.json(
      { error: "not_paused", message: "La sesión no está pausada" },
      { status: 400 },
    );
  }

  const pauseAt = parsePauseMarker(sesion.mensajeError);
  const elapsedMs = pauseAt ? Date.now() - pauseAt : 0;
  const shouldAutoWait = elapsedMs > PAUSE_AUTO_WAIT_THRESHOLD_MS;

  // Compute next numero + maybe create auto-wait step + flip to activa.
  try {
    const result = await prisma.$transaction(async (tx) => {
      let autoWaitCreated = false;

      if (shouldAutoWait) {
        const maxRow = await tx.pasoGrabado.findFirst({
          where: { sesionId: id },
          orderBy: { numero: "desc" },
          select: { numero: true },
        });
        const waitSec = (elapsedMs / 1000).toFixed(1);
        await tx.pasoGrabado.create({
          data: {
            sesionId: id,
            numero: (maxRow?.numero ?? 0) + 1,
            tipo: "esperar",
            origen: "auto",
            descripcion: `Esperar «pausa» ${waitSec}s`,
            selectorPrincipal: Prisma.JsonNull,
            selectoresRespaldo: Prisma.JsonNull,
            valor: null,
            esValorSensible: false,
          },
        });
        autoWaitCreated = true;
      }

      await tx.sesionGrabacion.update({
        where: { id },
        data: { estado: "activa", mensajeError: null },
      });

      return { autoWaitCreated };
    });

    return NextResponse.json({
      ok: true,
      estado: "activa",
      autoEsperaCreada: result.autoWaitCreated,
      elapsedMs,
    });
  } catch (err) {
    throw err;
  }
}
