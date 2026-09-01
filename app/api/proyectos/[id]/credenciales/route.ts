/**
 * GET /api/proyectos/[id]/credenciales
 *
 * Lista las credenciales de un proyecto sin exponer el `valor` cifrado.
 * Auth: requiere sesión (cualquier rol, no solo superadmin).
 *
 * Response 200: [{id, nombre, tipo, vence}, ...]
 * Response 401: {error:'No autenticado'}
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { CredencialListItem } from "@/lib/grabador/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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