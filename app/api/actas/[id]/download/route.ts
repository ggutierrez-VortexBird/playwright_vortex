/**
 * GET /api/actas/[id]/download
 *
 * Sirve el PDF del acta. La ruta se resuelve desde el modelo Acta
 * (1-a-1 con Ejecucion) leyendo la ruta del filesystem.
 *
 * Auth: requiere sesión activa. (Sin chequeo de owner — el modelo de
 * datos de ACTA hoy es single-tenant / single-user superadmin; podemos
 * endurecer en el futuro.)
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
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
    select: { id: true, rutaPdf: true, consecutivo: true },
  });

  if (!acta) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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