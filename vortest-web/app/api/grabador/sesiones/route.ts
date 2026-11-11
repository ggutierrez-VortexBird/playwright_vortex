/** POST: wrapper HTTP de la action `iniciarSesionGrabacion` (solo superadmin). */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { iniciarSesionGrabacion } from "@/lib/grabador/actions";
import type { NuevaGrabacionInput } from "@/lib/grabador/types";
import { mapErrorToResponse } from "@/lib/http/errors";

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
  } catch (err) {
    return mapErrorToResponse(err);
  }
}