/**
 * POST /api/casos/[id]/ejecutar
 *
 * Enqueue an Ejecucion for the given CasoPrueba.
 *
 * The actual execution is picked up by scripts/worker.ts polling for
 * pendiente executions (every 5s). This endpoint just creates the row.
 *
 * Auth: requires authenticated session.
 *
 * Responses:
 *   - 200 { ejecucionId, redirectTo: '/ejecuciones/[id]' }
 *   - 401 { error: 'No autenticado' }
 *   - 404 { error: 'not_found' }
 *   - 409 { error: 'caso_inactivo' }
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

  const caso = await prisma.casoPrueba.findUnique({
    where: { id },
    select: { id: true, activo: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!caso.activo) {
    return NextResponse.json({ error: "caso_inactivo" }, { status: 409 });
  }

  const ejecucion = await prisma.ejecucion.create({
    data: {
      casoPruebaId: caso.id,
      estado: "pendiente",
    },
  });

  return NextResponse.json({
    ejecucionId: ejecucion.id,
    redirectTo: `/ejecuciones/${ejecucion.id}`,
  });
}
