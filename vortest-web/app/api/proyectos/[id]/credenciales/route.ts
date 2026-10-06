/**
 * GET /api/proyectos/[id]/credenciales
 *
 * Lista las credenciales de un proyecto sin exponer el `valor` cifrado.
 * Auth: superadmin (política declarada en CLAUDE.md).
 *
 * Response 200: [{id, nombre, tipo, vence}, ...]
 * Response 401: {error:'No autenticado'}
 * Response 403: {error:'Sin permisos'}
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireSuperadmin, FORBIDDEN_ERROR } from "@/lib/auth";
import type { CredencialListItem } from "@/lib/grabador/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    await requireSuperadmin(session);
  } catch (err) {
    if (err === FORBIDDEN_ERROR || (err as { message?: string })?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    throw err;
  }

  const { id: proyectoId } = await params;

  const credenciales = await prisma.credencial.findMany({
    where: { proyectoId },
    select: {
      id: true,
      nombre: true,
      tipo: true,
      sesionVenceAt: true,
    },
    orderBy: { nombre: "asc" },
  });

  const out: CredencialListItem[] = credenciales.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo as CredencialListItem["tipo"],
    vence: c.sesionVenceAt ? c.sesionVenceAt.toISOString() : null,
  }));

  return NextResponse.json(out);
}