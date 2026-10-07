import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cambiarPasswordPropia } from "@/lib/perfil/actions";
import { mapErrorToResponse } from "@/lib/http/errors";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "validation", message: "El cuerpo de la petición no es JSON válido" }, { status: 400 });
  }

  if (typeof body?.actual !== "string" || typeof body?.nueva !== "string") {
    return NextResponse.json(
      { error: "validation", message: "actual y nueva son requeridos" },
      { status: 400 }
    );
  }

  try {
    const result = await cambiarPasswordPropia(body.actual, body.nueva, session);
    return NextResponse.json(result);
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
