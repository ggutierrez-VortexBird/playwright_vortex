/**
 * POST /api/casos/[id]/ejecutar
 *
 * Ruta legacy duplicada — el flujo recomendado es la Server Action
 * `dispararEjecucion` (lib/ejecuciones/actions.ts), que ya trae el guard
 * anti-concurrencia (`FOR UPDATE NOWAIT`) y el despacho a RabbitMQ. Esta
 * ruta DELEGA en esa misma función en vez de crear su propia `Ejecucion`
 * a mano. Deuda preexistente señalada, no resuelta acá (ver EST-01): seguir
 * teniendo dos entry points para lo mismo (esta ruta HTTP + la Server
 * Action).
 *
 * Auth: requires authenticated session.
 *
 * Responses:
 *   - 201 { ejecucionId, redirectTo: '/ejecuciones/[id]' }
 *   - 401 { error: 'No autenticado' }
 *   - 403 { error: 'Sin permisos' }
 *   - 404 { error: 'not_found' }
 *   - 409 { error: 'caso_inactivo' | 'ejecucion_en_curso' }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireProyectoAccess } from "@/lib/auth";
import { dispararEjecucion } from "@/lib/ejecuciones/actions";
import { YA_EXISTE_EJECUCION_EN_CURSO_ERROR } from "@/lib/ejecuciones/errors";
import { withAuth } from "@/lib/http/with-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const POST = withAuth<RouteParams>(async (_request, { params }, session) => {
  const { id } = await params;

  const caso = await prisma.casoPrueba.findUnique({
    where: { id },
    select: { id: true, activo: true, proyectoId: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await requireProyectoAccess(session, caso.proyectoId);

  if (!caso.activo) {
    return NextResponse.json({ error: "caso_inactivo" }, { status: 409 });
  }

  try {
    const { id: ejecucionId } = await dispararEjecucion(caso.id);
    // ERR-04: la creación de una Ejecucion responde 201.
    return NextResponse.json(
      { ejecucionId, redirectTo: `/ejecuciones/${ejecucionId}` },
      { status: 201 },
    );
  } catch (err) {
    if (err === YA_EXISTE_EJECUCION_EN_CURSO_ERROR) {
      return NextResponse.json({ error: "ejecucion_en_curso" }, { status: 409 });
    }
    throw err;
  }
});
