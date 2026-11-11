/** POST /api/casos/[id]/ejecutar: lanza la ejecución de un caso y responde 201. */

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
    return NextResponse.json(
      { ejecucionId, redirectTo: `/ejecuciones/${ejecucionId}` },
      { status: 201 },
    );
  } catch (err) {
    if (err === YA_EXISTE_EJECUCION_EN_CURSO_ERROR) {
      const enCurso = await prisma.ejecucion.findFirst({
        where: { casoPruebaId: caso.id, estado: { in: ["pendiente", "corriendo"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      return NextResponse.json({ error: "ejecucion_en_curso", ejecucionId: enCurso?.id }, { status: 409 });
    }
    throw err;
  }
});
