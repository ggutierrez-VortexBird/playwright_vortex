/** GET: lista los parámetros del caso con `enUso` recalculado (credenciales sin valor). */

import { NextResponse } from "next/server";
import { getSession, requireProyectoAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listarParametrosConEnUso } from "@/lib/casos/parametros";
import { mapErrorToResponse } from "@/lib/http/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 },
    );
  }

  const { id: casoPruebaId } = await params;

  const caso = await prisma.casoPrueba.findUnique({
    where: { id: casoPruebaId },
    select: { id: true, proyectoId: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  try {
    await requireProyectoAccess(session, caso.proyectoId);
  } catch (err) {
    return mapErrorToResponse(err);
  }

  const parametros = await listarParametrosConEnUso(casoPruebaId);
  return NextResponse.json({ parametros });
}