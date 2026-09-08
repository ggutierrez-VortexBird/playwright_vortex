/**
 * POST /api/grabador/sesiones
 *
 * Wrapper HTTP que invoca la Server Action `iniciarSesionGrabacion`.
 * Auth: superadmin (via la action).
 *
 * Request body: NuevaGrabacionInput
 * Response 201: SesionGrabacionOut
 * Errors: 400 (validation), 401 (no session), 403 (forbidden), 503 (recorder)
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { iniciarSesionGrabacion } from "@/lib/grabador/actions";
import type { NuevaGrabacionInput } from "@/lib/grabador/types";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: NuevaGrabacionInput;
  try {
    body = (await request.json()) as NuevaGrabacionInput;
  } catch {
    return NextResponse.json(
      { error: "validation", message: "JSON inválido" },
      { status: 400 },
    );
  }

  try {
    const result = await iniciarSesionGrabacion(body, session);
    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}