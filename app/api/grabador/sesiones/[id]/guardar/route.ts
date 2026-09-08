/**
 * POST /api/grabador/sesiones/[id]/guardar — V2 (Pivot playwright-codegen).
 *
 * EN V1 esta ruta:
 *   1. Cargaba pasos + parametros de DB.
 *   2. Generaba el script via `serializarPasos(pasos, {parametros})`.
 *      Esa función aplicaba decisiones de diseño: comments por línea,
 *      dedupe de fills, fallback assertion `toBeVisible`, TODOs, wrap
 *      en `const params = {...}`, etc.
 *   3. Creaba el CasoPrueba con ese script decorado.
 *
 * EN V2 todo eso se va. La ruta:
 *   1. Carga `specCode` (raw .spec.ts) de la sesionGrabacion, o usa el
 *      `script` del body si el QA lo editó en el editor de la pantalla de
 *      revisión antes de guardar (edición explícita del usuario, no una
 *      decoración automática — la política ZERO modificación sigue
 *      aplicando a lo que produce el grabador, no a lo que el humano
 *      decide cambiar a mano).
 *   2. Valida que no esté vacío.
 *   3. Crea el CasoPrueba con ese script literal — sin ninguna
 *      transformación propia.
 *   4. Marca la sesion como 'guardada', linkeada al casoPruebaId.
 *   5. Si el body pide `ejecutar: true`, encola una Ejecucion inmediata
 *      (reutiliza `dispararEjecucion`, que ya protege contra carreras) y
 *      devuelve el redirectTo apuntando a /ejecuciones/[id] en vez de
 *      /casos/[id].
 *
 * Si el QA guardó en V1 antes del pivot y nunca terminó, su sesion va
 * a llegar acá sin specCode (porque era PasoGrabado[]) — la ruta
 * rechaza con 400 'no_spec_code' y le pedimos que regenere.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, requireSuperadmin } from "@/lib/auth";
import { dispararEjecucion } from "@/lib/ejecuciones/actions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface GuardarBody {
  /** Script editado a mano en el editor de revisión. Si viene vacío o no
   *  viene, se usa el `specCode` tal cual lo escribió el grabador. */
  script?: string;
  /** Si es true, además de guardar el caso se encola una ejecución
   *  inmediata y el redirectTo apunta a /ejecuciones/[id]. */
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
    try {
      await requireSuperadmin(session);
    } catch {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
        estado: true,
        specCode: true,
        codegenFilePath: true,
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

    const scriptEditado =
      typeof body.script === "string" ? body.script.trim() : "";
    const specCode = scriptEditado || (sesion.specCode?.trim() ?? "");
    if (!specCode) {
      return NextResponse.json(
        {
          error: "no_spec_code",
          message:
            "La sesión no tiene un .spec.ts. Volvé a grabar con `npx playwright codegen` para que Playwright emita el script.",
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

    // Política ZERO modificación: `script` es el raw spec.ts, sin
    // comments extras, sin waits, sin params object, sin asserts fallback.
    const casoCreado = await prisma.$transaction(async (tx) => {
      const caso = await tx.casoPrueba.create({
        data: {
          proyectoId: sesion.proyectoId,
          codigo,
          nombre: nombreCaso,
          script: specCode,
          scriptFileName: deriveScriptFileName(nombreCaso),
          responsableId: sesion.usuarioId,
          origen: "grabador",
        },
      });
      await tx.sesionGrabacion.update({
        where: { id: sesionId },
        data: {
          estado: "guardada",
          casoPruebaId: caso.id,
          endedAt: new Date(),
        },
      });
      return caso;
    });

    if (!body.ejecutar) {
      return NextResponse.json({
        casoPruebaId: casoCreado.id,
        redirectTo: `/casos/${casoCreado.id}`,
      });
    }

    // "Guardar y ejecutar": el caso ya está persistido, así que un fallo acá
    // no debe borrar el guardado — se informa aparte y el caso queda
    // disponible para ejecutarlo a mano desde su detalle.
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
    throw err;
  }
}
