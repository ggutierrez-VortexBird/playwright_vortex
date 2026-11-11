/** PATCH: actualiza el valor por defecto de un parámetro (los de credencial no son editables). */

import { NextResponse } from "next/server";
import { getSession, requireProyectoAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { actualizarValorDefecto } from "@/lib/casos/parametros";
import { mapErrorToResponse } from "@/lib/http/errors";

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

  // Verifica que el caso exista y haya acceso.
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

  // Distingue 404 de 403 (credencial).
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