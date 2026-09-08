/**
 * PATCH /api/casos/[id]/parametros/[paramId]
 *
 * Actualiza el valor por defecto de un ParametroGrabacion (HU-G12).
 *
 * Body (JSON):
 *   { valorDefecto: string | null }
 *
 * Reglas:
 *   - El parametro debe pertenecer al caso dado (no cross-case writes).
 *   - Los parametros con origen='credencial' NO son editables
 *     (responde 403 { error: 'forbidden', message: 'credencial' }).
 *
 * Responses:
 *   - 200 { parametro: ParametroConEnUso } OK
 *   - 400 { error: 'validation', message }
 *   - 401 { error: 'No autenticado' }
 *   - 403 { error: 'forbidden', message: 'credencial' }
 *   - 404 { error: 'not_found' }
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { actualizarValorDefecto } from "@/lib/casos/parametros";

interface RouteParams {
  params: Promise<{ id: string; paramId: string }>;
}

interface PatchBody {
  valorDefecto?: unknown;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 },
    );
  }

  const { id: casoPruebaId, paramId } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "validation", message: "JSON inválido" },
      { status: 400 },
    );
  }

  if (body.valorDefecto !== null && typeof body.valorDefecto !== "string") {
    return NextResponse.json(
      {
        error: "validation",
        message: "valorDefecto debe ser string o null",
      },
      { status: 400 },
    );
  }

  // Verify caso exists before attempting update.
  const caso = await prisma.casoPrueba.findUnique({
    where: { id: casoPruebaId },
    select: { id: true },
  });
  if (!caso) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Pre-check to differentiate 404 (not found) vs 403 (credencial).
  const existing = await prisma.parametroGrabacion.findFirst({
    where: { id: paramId, casoPruebaId },
    select: { id: true, origen: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (existing.origen === "credencial") {
    return NextResponse.json(
      {
        error: "forbidden",
        message: "credencial",
      },
      { status: 403 },
    );
  }

  const updated = await actualizarValorDefecto(
    casoPruebaId,
    paramId,
    body.valorDefecto as string | null,
  );
  if (!updated) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ parametro: updated });
}