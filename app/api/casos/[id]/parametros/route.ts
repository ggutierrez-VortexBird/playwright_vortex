/**
 * GET /api/casos/[id]/parametros
 *
 * Lista los ParametroGrabacion asociados a un CasoPrueba, con el flag
 * `enUso` recalculado a partir de los pasos actuales (HU-G12).
 *
 * Auth: requiere sesión autenticada (cualquier rol). El caso debe
 * existir; los params de credencial se devuelven con `valorDefecto=null`
 * para no exponer el plaintext.
 *
 * Responses:
 *   - 200 { parametros: ParametroConEnUso[] }
 *   - 401 { error: 'No autenticado' }
 *   - 404 { error: 'not_found' }
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listarParametrosConEnUso } from "@/lib/casos/parametros";

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
    select: { id: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const parametros = await listarParametrosConEnUso(casoPruebaId);
  return NextResponse.json({ parametros });
}