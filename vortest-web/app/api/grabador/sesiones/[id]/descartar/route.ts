/**
 * POST /api/grabador/sesiones/[id]/descartar
 *
 * Marca una SesionGrabacion como 'descartada'. El browser del usuario
 * también cierra el WS (vía handleDescartar en grabador-client.tsx).
 * El worker, al ver el WS cerrado, ya matará el subprocess de codegen.
 *
 * Auth: superadmin (via getSession).
 * Estado permitidos desde: 'iniciando' | 'activa' | 'detenida' — nunca
 * si la sesión ya tiene CasoPrueba asociado.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const updated = await prisma.sesionGrabacion.update({
      where: { id, usuarioId: session.userId },
      data: {
        estado: "descartada",
        endedAt: new Date(),
      },
      select: { id: true, estado: true },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (err: unknown) {
    // Si la sesión no le pertenece al usuario, Prisma lanza `RecordNotFound`.
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code?: string }).code === "P2025"
    ) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "internal", message: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
