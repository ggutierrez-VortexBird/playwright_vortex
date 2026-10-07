import { NextResponse } from "next/server";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { listEspacios, createEspacio } from "@/lib/espacios/actions";
import { mapErrorToResponse } from "@/lib/http/errors";

export async function GET() {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const usuario = await getUsuarioActual(session);
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const espacios = await listEspacios(usuario);
  return NextResponse.json(espacios);
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "validation", message: "El cuerpo de la petición no es JSON válido" }, { status: 400 });
  }

  try {
    const espacio = await createEspacio(body, session);
    return NextResponse.json(espacio, { status: 201 });
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
