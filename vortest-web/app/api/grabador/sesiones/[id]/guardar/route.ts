/** POST: crea el caso con el specCode de la sesión (o el script editado) tal cual; con `ejecutar: true` encola además una ejecución. */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireProyectoAccess } from "@/lib/auth";
import { dispararEjecucion } from "@/lib/ejecuciones/actions";
import { mapErrorToResponse } from "@/lib/http/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface GuardarBody {
  /** Script editado a mano; si falta se usa el specCode del grabador. */
  script?: string;
  /** Si es true, además de guardar encola una ejecución inmediata. */
  ejecutar?: boolean;
}

function generateCasoCodigo(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `CP-${ts}-${rand}`;
}

function deriveScriptFileName(casoNombre: string): string {
  const slug = casoNombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "caso"}.spec.ts`;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id: sesionId } = await params;

    let body: GuardarBody = {};
    try {
      const raw = await request.text();
      if (raw) body = JSON.parse(raw) as GuardarBody;
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }

    const sesion = await prisma.sesionGrabacion.findUnique({
      where: { id: sesionId },
      select: {
        id: true,
        usuarioId: true,
        nombre: true,
        proyectoId: true,
        parentCaseId: true,
        estado: true,
        specCode: true,
        codegenFilePath: true,
      },
    });

    if (!sesion) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    try {
      await requireProyectoAccess(session, sesion.proyectoId);
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (sesion.usuarioId !== session.userId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    if (sesion.estado === "descartada" || sesion.estado === "guardada") {
      return NextResponse.json(
        {
          error: "cannot_save",
          message: `La sesión ya está en estado '${sesion.estado}'`,
        },
        { status: 400 },
      );
    }

    const scriptEditado =
      typeof body.script === "string" ? body.script.trim() : "";
    const specCode = scriptEditado || (sesion.specCode?.trim() ?? "");
    if (!specCode) {
      return NextResponse.json(
        {
          error: "no_spec_code",
          message:
            "La sesión no tiene un .spec.ts. Vuelve a grabar con `npx playwright codegen` para que Playwright emita el script.",
        },
        { status: 400 },
      );
    }

    let codigo = generateCasoCodigo();
    for (let i = 0; i < 3; i += 1) {
      const exists = await prisma.casoPrueba.findFirst({
        where: { proyectoId: sesion.proyectoId, codigo },
        select: { id: true },
      });
      if (!exists) break;
      codigo = generateCasoCodigo();
    }

    const nombreCaso = sesion.nombre || "Sin nombre";

    // Política de cero modificación: el script es el spec.ts crudo.
    const casoCreado = await prisma.$transaction(async (tx) => {
      // Se toma la sesión antes de crear el caso: de dos "Guardar" simultáneos sólo el primero pasa este update.
      try {
        await tx.sesionGrabacion.update({
          where: { id: sesionId, estado: { notIn: ["descartada", "guardada"] } },
          data: { estado: "guardada", endedAt: new Date() },
        });
      } catch (err) {
        if ((err as { code?: string })?.code === "P2025") return null;
        throw err;
      }
      const caso = await tx.casoPrueba.create({
        data: {
          proyectoId: sesion.proyectoId,
          codigo,
          nombre: nombreCaso,
          script: specCode,
          scriptFileName: deriveScriptFileName(nombreCaso),
          responsableId: sesion.usuarioId,
          origen: "grabador",
          parentCaseId: sesion.parentCaseId,
        },
      });
      await tx.sesionGrabacion.update({
        where: { id: sesionId },
        data: { casoPruebaId: caso.id },
      });
      return caso;
    });

    if (!casoCreado) {
      return NextResponse.json(
        { error: "cannot_save", message: "La grabación ya se guardó o se descartó." },
        { status: 409 },
      );
    }

    if (!body.ejecutar) {
      return NextResponse.json({
        casoPruebaId: casoCreado.id,
        redirectTo: `/casos/${casoCreado.id}`,
      });
    }

    // El caso ya está guardado: un fallo al ejecutar no lo borra y se informa aparte.
    try {
      const ejecucion = await dispararEjecucion(casoCreado.id);
      return NextResponse.json({
        casoPruebaId: casoCreado.id,
        ejecucionId: ejecucion.id,
        redirectTo: `/ejecuciones/${ejecucion.id}`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No se pudo encolar la ejecución";
      return NextResponse.json({
        casoPruebaId: casoCreado.id,
        redirectTo: `/casos/${casoCreado.id}`,
        ejecucionError: message,
      });
    }
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code?: string }).code;
      if (code === "P2002") {
        return NextResponse.json(
          { error: "duplicate", message: "Código duplicado — intentá de nuevo" },
          { status: 409 },
        );
      }
    }
    return mapErrorToResponse(err);
  }
}
