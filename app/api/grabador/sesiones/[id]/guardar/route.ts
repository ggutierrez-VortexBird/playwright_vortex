/**
 * POST /api/grabador/sesiones/[id]/guardar
 *
 * Persiste un CasoPrueba a partir de una SesionGrabacion:
 *   1. Lee pasos + parametros desde DB.
 *   2. Genera el script .spec.ts via `serializarPasos`.
 *   3. Crea CasoPrueba con origen='grabador', codigo=CP-{ts}, etc.
 *   4. Liga ParametroGrabacion.casoPruebaId (transferencia sesionId → casoPruebaId).
 *   5. Marca SesionGrabacion.estado='guardada', casoPruebaId=<id>.
 *   6. Si `?ejecutar=true`, encola la ejecución via worker.
 *
 * Auth: requiere ser owner de la sesión (superadmin-only via requireSuperadmin).
 *
 * Responses:
 *   - 200 { casoPruebaId, ejecucionId?, redirectTo }
 *   - 401 / 403 / 404 / 400 según corresponda
 *   - 500 en errores inesperados
 */

import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession, requireSuperadmin } from "@/lib/auth";
import { serializarPasos, type PasoParaSerializar, type ParametroParaSerializar } from "@/lib/grabador/codegen/serialize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Genera un codigo de caso: CP-{TS}-{rand4} para evitar colisiones. */
function generateCasoCodigo(): string {
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `CP-${ts}-${rand}`;
}

/** Deriva un nombre de archivo .spec.ts razonable del nombre del caso. */
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

    // requireSuperadmin — solo superadmin puede guardar casos.
    try {
      await requireSuperadmin(session);
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { id: sesionId } = await params;

    const sesion = await prisma.sesionGrabacion.findUnique({
      where: { id: sesionId },
      select: {
        id: true,
        usuarioId: true,
        nombre: true,
        proyectoId: true,
        estado: true,
        pasos: {
          orderBy: { numero: "asc" },
          select: {
            id: true,
            numero: true,
            tipo: true,
            descripcion: true,
            selectorPrincipal: true,
            selectoresRespaldo: true,
            valor: true,
            esValorSensible: true,
            assertionKind: true,
          },
        },
        parametros: {
          orderBy: { nombre: "asc" },
          select: { nombre: true, valorDefecto: true },
        },
      },
    });

    if (!sesion) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
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
    if (sesion.pasos.length === 0) {
      return NextResponse.json(
        { error: "no_pasos", message: "La sesión no tiene pasos para guardar" },
        { status: 400 },
      );
    }

    // Genera codigo único para evitar colisiones.
    let codigo = generateCasoCodigo();
    // Best-effort retry loop (rare collision; OK if it stays).
    for (let i = 0; i < 3; i++) {
      const exists = await prisma.casoPrueba.findFirst({
        where: { proyectoId: sesion.proyectoId, codigo },
        select: { id: true },
      });
      if (!exists) break;
      codigo = generateCasoCodigo();
    }

    const nombreCaso = sesion.nombre || "Sin nombre";

    // Shape para el serializer.
    const pasosSerializer: PasoParaSerializar[] = sesion.pasos.map((p) => ({
      id: p.id,
      numero: p.numero,
      tipo: p.tipo,
      descripcion: p.descripcion,
      selectorPrincipal: p.selectorPrincipal,
      selectoresRespaldo: p.selectoresRespaldo,
      valor: p.valor,
      esValorSensible: p.esValorSensible,
      assertionKind: p.assertionKind,
    }));
    const parametrosSerializer: ParametroParaSerializar[] = sesion.parametros;

    const script = serializarPasos(pasosSerializer, {
      nombreDelCaso: nombreCaso,
      parametros: parametrosSerializer,
    });

    const scriptFileName = deriveScriptFileName(nombreCaso);

    // Persiste en una transacción.
    const casoCreado = await prisma.$transaction(async (tx) => {
      const caso = await tx.casoPrueba.create({
        data: {
          proyectoId: sesion.proyectoId,
          codigo,
          nombre: nombreCaso,
          script,
          scriptFileName,
          responsableId: sesion.usuarioId,
          origen: "grabador",
        },
      });

      // Traslada ParametroGrabacion de sesionId a casoPruebaId.
      if (sesion.parametros.length > 0) {
        await tx.parametroGrabacion.updateMany({
          where: { sesionId },
          data: { casoPruebaId: caso.id, sesionId: null },
        });
      }

      // Traslada PasoGrabado al CasoPrueba también.
      await tx.pasoGrabado.updateMany({
        where: { sesionId },
        data: { casoPruebaId: caso.id },
      });

      // Marca la sesion como guardada.
      await tx.sesionGrabacion.update({
        where: { id: sesionId },
        data: { estado: "guardada", casoPruebaId: caso.id, endedAt: new Date() },
      });

      return caso;
    });

    // Si ejecutar=true, enqueue la ejecución.
    const url = new URL(request.url);
    const ejecutar = url.searchParams.get("ejecutar") === "true";
    let ejecucionId: string | undefined;
    if (ejecutar) {
      const ejecucion = await prisma.ejecucion.create({
        data: {
          casoPruebaId: casoCreado.id,
          estado: "pendiente",
        },
      });
      ejecucionId = ejecucion.id;
      // El worker (scripts/worker.ts) reclama ejecuciones pendientes cada
      // 5s. No necesitamos hacer nada más acá — el polling lo recoge.
    }

    return NextResponse.json({
      casoPruebaId: casoCreado.id,
      ...(ejecucionId ? { ejecucionId } : {}),
      redirectTo: ejecucionId ? `/ejecuciones/${ejecucionId}` : `/casos/${casoCreado.id}`,
    });
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
    if (err && typeof err === "object" && "status" in err) {
      const status = (err as { status?: number }).status;
      if (status === 403) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }
    throw err;
  }
}
