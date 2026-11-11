/** GET /api/actas/[id]/download: sirve el PDF del acta (requiere acceso al proyecto). */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireProyectoAccess, FORBIDDEN_ERROR } from "@/lib/auth";
import * as fs from "node:fs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const acta = await prisma.acta.findUnique({
    where: { id },
    select: {
      id: true,
      rutaPdf: true,
      consecutivo: true,
      ejecucion: { select: { casoPrueba: { select: { proyectoId: true } } } },
    },
  });

  if (!acta) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    await requireProyectoAccess(session, acta.ejecucion.casoPrueba.proyectoId);
  } catch (err) {
    if (err === FORBIDDEN_ERROR || (err as { message?: string })?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    throw err;
  }

  if (!acta.rutaPdf || !fs.existsSync(acta.rutaPdf)) {
    return NextResponse.json(
      { error: "file_missing", message: "El PDF del acta no está disponible" },
      { status: 404 },
    );
  }

  const stream = fs.createReadStream(acta.rutaPdf);
  return new Response(stream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="acta-${acta.consecutivo}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}