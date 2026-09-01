/**
 * /api/grabador/sesiones/[id]/pasos
 *
 * POST: create a PasoGrabado (HU-G6 agregar verificación, HU-G10 paso manual)
 * PATCH: reorder pasos via drag-and-drop (HU-G8)
 *
 * Auth: requiere ser owner de la sesión.
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/* ====================================================================== */
/* POST — create a single paso (HU-G6, HU-G10)                            */
/* ====================================================================== */

const TIPOS_VALIDOS = new Set([
  "navegar",
  "clic",
  "escribir",
  "seleccionar",
  "esperar",
  "verificar",
  "generico",
]);
const ORÍGENES_VALIDOS = new Set(["manual", "grabado", "auto"]);
const ASSERTIONS_VALIDAS = new Set([
  "visible",
  "texto_igual",
  "texto_contiene",
  "valor_igual",
  "count",
]);

interface PostBody {
  tipo?: string;
  origen?: string;
  descripcion?: string;
  selectorPrincipal?: unknown;
  selectoresRespaldo?: unknown;
  valor?: string | null;
  valorEsperado?: string | null;
  assertionKind?: string;
  numero?: number;
}

/** Calcula el próximo numero disponible. */
async function resolverNumero(
  sesionId: string,
  numeroSolicitado: number | undefined,
): Promise<number> {
  if (numeroSolicitado !== undefined) {
    if (
      typeof numeroSolicitado !== "number" ||
      !Number.isInteger(numeroSolicitado) ||
      numeroSolicitado < 1
    ) {
      throw Object.assign(new Error("numero inválido"), { status: 400 });
    }
    return numeroSolicitado;
  }
  const maxRow = await prisma.pasoGrabado.findFirst({
    where: { sesionId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  return (maxRow?.numero ?? 0) + 1;
}

/** Renumera los pasos >= fromNumero sumando +1, dejando lugar al nuevo. */
async function desplazarPasos(
  tx: Prisma.TransactionClient,
  sesionId: string,
  fromNumero: number,
): Promise<void> {
  const futuros = await tx.pasoGrabado.findMany({
    where: { sesionId, numero: { gte: fromNumero } },
    orderBy: { numero: "desc" },
    select: { id: true, numero: true },
  });
  for (const p of futuros) {
    await tx.pasoGrabado.update({
      where: { id: p.id },
      data: { numero: p.numero + 1 },
    });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: sesionId } = await params;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { error: "validation", message: "JSON inválido" },
      { status: 400 },
    );
  }

  const tipo = body.tipo ?? "";
  const origen = body.origen ?? "manual";
  const descripcion = (body.descripcion ?? "").trim();
  if (!TIPOS_VALIDOS.has(tipo)) {
    return NextResponse.json(
      { error: "validation", message: `tipo debe ser uno de: ${[...TIPOS_VALIDOS].join(", ")}` },
      { status: 400 },
    );
  }
  if (!ORÍGENES_VALIDOS.has(origen)) {
    return NextResponse.json(
      { error: "validation", message: `origen debe ser uno de: ${[...ORÍGENES_VALIDOS].join(", ")}` },
      { status: 400 },
    );
  }
  if (!descripcion) {
    return NextResponse.json(
      { error: "validation", message: "descripcion es requerida" },
      { status: 400 },
    );
  }
  if (body.assertionKind && !ASSERTIONS_VALIDAS.has(body.assertionKind)) {
    return NextResponse.json(
      {
        error: "validation",
        message: `assertionKind debe ser uno de: ${[...ASSERTIONS_VALIDAS].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id: sesionId },
    select: { id: true, usuarioId: true },
  });
  if (!sesion) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const paso = await prisma.$transaction(async (tx) => {
      const numero = await resolverNumero(sesionId, body.numero);
      if (body.numero !== undefined) {
        const countExistente = await tx.pasoGrabado.count({
          where: { sesionId, numero },
        });
        if (countExistente > 0) {
          await desplazarPasos(tx, sesionId, numero);
        }
      }
      return tx.pasoGrabado.create({
        data: {
          sesionId,
          numero,
          tipo,
          origen,
          descripcion,
          selectorPrincipal:
            body.selectorPrincipal === undefined
              ? Prisma.JsonNull
              : (body.selectorPrincipal as Prisma.InputJsonValue),
          selectoresRespaldo:
            body.selectoresRespaldo === undefined || body.selectoresRespaldo === null
              ? Prisma.JsonNull
              : (body.selectoresRespaldo as Prisma.InputJsonValue),
          valor: body.valor ?? null,
          esValorSensible: false,
          assertionKind: body.assertionKind ?? null,
        },
      });
    });

    return NextResponse.json({ paso }, { status: 201 });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "status" in err) {
      const status = (err as { status?: number }).status;
      if (status === 400) {
        return NextResponse.json(
          {
            error: "validation",
            message: (err as { message?: string }).message ?? "validation",
          },
          { status: 400 },
        );
      }
    }
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "numero_conflict", message: "Número de paso ya existe" },
        { status: 409 },
      );
    }
    throw err;
  }
}

/* ====================================================================== */
/* PATCH — reorder (HU-G8)                                                 */
/* ====================================================================== */

interface PatchBody {
  orderedIds?: string[];
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id: sesionId } = await params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { error: "validation", message: "JSON inválido" },
      { status: 400 },
    );
  }

  const orderedIds = body.orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json(
      { error: "validation", message: "orderedIds debe ser un array no-vacío de strings" },
      { status: 400 },
    );
  }
  if (orderedIds.some((id) => typeof id !== "string" || id.length === 0)) {
    return NextResponse.json(
      { error: "validation", message: "orderedIds contiene IDs inválidos" },
      { status: 400 },
    );
  }

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id: sesionId },
    select: {
      id: true,
      usuarioId: true,
      pasos: { select: { id: true }, orderBy: { numero: "asc" } },
    },
  });
  if (!sesion) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (sesion.usuarioId !== session.userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Verify the provided IDs match the session's pasos exactly.
  const existingIds = sesion.pasos.map((p) => p.id).sort();
  const providedIds = [...orderedIds].sort();
  if (
    existingIds.length !== providedIds.length ||
    existingIds.some((id, i) => id !== providedIds[i])
  ) {
    return NextResponse.json(
      {
        error: "length_mismatch",
        message: "orderedIds no coincide con los pasos actuales de la sesión",
      },
      { status: 409 },
    );
  }

  // Renumber in a transaction. Two-phase to avoid unique constraint collisions:
  //   phase 1: assign negative numbers (-1, -2, ...) to break the (sesionId, numero) unique
  //   phase 2: assign positive numbers 1..N in the desired order
  const updated = await prisma.$transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.pasoGrabado.update({
        where: { id: orderedIds[i] },
        data: { numero: -1 - i },
      });
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.pasoGrabado.update({
        where: { id: orderedIds[i] },
        data: { numero: i + 1 },
      });
    }
    return tx.pasoGrabado.findMany({
      where: { sesionId },
      orderBy: { numero: "asc" },
    });
  });

  return NextResponse.json({ ok: true, pasos: updated });
}
