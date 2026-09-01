/**
 * /api/grabador/sesiones/[id]/pasos/[pasoId]
 *
 * PATCH: edita un PasoGrabado (descripcion / selectorPrincipal / valor).
 *        Si el flag `actualizarDefaultParametro` viene true y el paso está
 *        vinculado a un ParametroGrabacion por nombre (heurística: el valor
 *        contiene `{{nombre}}`), actualiza `valorDefecto`.
 *
 * DELETE: elimina el paso y renumera los siguientes.
 *
 * Auth: requiere ser owner de la sesión.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string; pasoId: string }>;
}

/* ====================================================================== */
/* PATCH                                                                   */
/* ====================================================================== */

interface PatchBody {
  descripcion?: string;
  selectorPrincipal?: unknown;
  valor?: string | null;
  /** Si true, propaga el nuevo `valor` al ParametroGrabacion vinculado. */
  actualizarDefaultParametro?: boolean;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: sesionId, pasoId } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "validation", message: "JSON inválido" },
      { status: 400 },
    );
  }

  const paso = await prisma.pasoGrabado.findUnique({
    where: { id: pasoId },
    select: {
      id: true,
      sesionId: true,
      descripcion: true,
      valor: true,
      sesion: { select: { usuarioId: true } },
    },
  });
  if (!paso || paso.sesionId !== sesionId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (paso.sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Validate descripcion if provided.
  if (body.descripcion !== undefined) {
    const d = body.descripcion.trim();
    if (!d) {
      return NextResponse.json(
        { error: "validation", message: "descripcion no puede estar vacío" },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const updatedPaso = await tx.pasoGrabado.update({
        where: { id: pasoId },
        data: {
          ...(body.descripcion !== undefined
            ? { descripcion: body.descripcion.trim() }
            : {}),
          ...(body.selectorPrincipal !== undefined
            ? {
                selectorPrincipal:
                  body.selectorPrincipal === null
                    ? Prisma.JsonNull
                    : (body.selectorPrincipal as Prisma.InputJsonValue),
              }
            : {}),
          ...(body.valor !== undefined ? { valor: body.valor } : {}),
        },
      });

      // Heuristic: if actualizarDefaultParametro=true, find any ParametroGrabacion
      // whose name appears as `{{nombre}}` in the paso's valor OR descripcion
      // and update its valorDefecto to the new valor (or descripcion-trim if no valor).
      if (body.actualizarDefaultParametro) {
        const newDefault =
          body.valor ?? body.descripcion?.trim() ?? paso.valor ?? "";
        const parametros = await tx.parametroGrabacion.findMany({
          where: { sesionId },
          select: { id: true, nombre: true },
        });
        const matches = parametros.filter((p) => {
          const ref = `{{${p.nombre}}}`;
          return (
            paso.valor?.includes(ref) ||
            paso.descripcion.includes(ref) ||
            (body.descripcion?.includes(ref) ?? false) ||
            (body.valor?.includes(ref) ?? false)
          );
        });
        for (const m of matches) {
          await tx.parametroGrabacion.update({
            where: { id: m.id },
            data: { valorDefecto: newDefault },
          });
        }
      }

      return updatedPaso;
    });

    return NextResponse.json({ ok: true, paso: updated });
  } catch (err) {
    throw err;
  }
}

/* ====================================================================== */
/* DELETE                                                                  */
/* ====================================================================== */

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: sesionId, pasoId } = await params;

  const paso = await prisma.pasoGrabado.findUnique({
    where: { id: pasoId },
    select: {
      id: true,
      sesionId: true,
      numero: true,
      sesion: { select: { usuarioId: true } },
    },
  });
  if (!paso || paso.sesionId !== sesionId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (paso.sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Renumber in a transaction: delete then shift numero-1 for all pasos > numero.
  await prisma.$transaction(async (tx) => {
    await tx.pasoGrabado.delete({ where: { id: pasoId } });
    const futuros = await tx.pasoGrabado.findMany({
      where: { sesionId, numero: { gt: paso.numero } },
      orderBy: { numero: "asc" },
      select: { id: true, numero: true },
    });
    for (const p of futuros) {
      await tx.pasoGrabado.update({
        where: { id: p.id },
        data: { numero: p.numero - 1 },
      });
    }
  });

  return NextResponse.json({ ok: true, deleted: pasoId });
}
