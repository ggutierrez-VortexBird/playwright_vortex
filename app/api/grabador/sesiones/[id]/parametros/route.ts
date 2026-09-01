/**
 * POST /api/grabador/sesiones/[id]/parametros
 *
 * Crea un ParametroGrabacion para una sesión.
 *
 * Body (JSON):
 *   {
 *     nombre: string,           // snake_case recomendado, validado
 *     valorDefecto: string | null,
 *     origen: 'manual' | 'credencial' | 'auto',
 *     credencialId?: string | null,
 *   }
 *
 * Auth: requiere ser owner de la sesión (usuarioId = session.userId).
 *
 * Responses:
 *   - 201 { parametro: <ParametroGrabacion> }  OK
 *   - 400 { error: 'validation', message }
 *   - 401 { error: 'No autenticado' }
 *   - 403 { error: 'forbidden' }
 *   - 404 { error: 'not_found' }
 *   - 409 { error: 'duplicate', message }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ORÍGENES_VALIDOS = new Set(["manual", "credencial", "auto"]);
const NOMBRE_REGEX = /^[a-zA-Z][a-zA-Z0-9_]{0,49}$/;

interface PostBody {
  nombre?: string;
  valorDefecto?: string | null;
  origen?: string;
  credencialId?: string | null;
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

  const nombre = (body.nombre ?? "").trim();
  if (!nombre || !NOMBRE_REGEX.test(nombre)) {
    return NextResponse.json(
      {
        error: "validation",
        message:
          "nombre es requerido (1-50 chars, debe empezar con letra; solo letras/dígitos/_)",
      },
      { status: 400 },
    );
  }

  const origen = body.origen ?? "manual";
  if (!ORÍGENES_VALIDOS.has(origen)) {
    return NextResponse.json(
      {
        error: "validation",
        message: `origen debe ser uno de: ${[...ORÍGENES_VALIDOS].join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Ownership
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
    const parametro = await prisma.parametroGrabacion.create({
      data: {
        sesionId,
        nombre,
        valorDefecto: body.valorDefecto ?? null,
        origen,
        credencialId: body.credencialId ?? null,
      },
    });
    return NextResponse.json({ parametro }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json(
        { error: "duplicate", message: "Ya existe un parámetro con ese nombre en la sesión" },
        { status: 409 },
      );
    }
    throw err;
  }
}
