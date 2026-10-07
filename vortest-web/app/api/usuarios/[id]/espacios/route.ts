import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listEspaciosDeUsuario, setEspaciosDeUsuario } from "@/lib/usuarios/actions";
import { mapErrorToResponse } from "@/lib/http/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const espacios = await listEspaciosDeUsuario(id, session);
    return NextResponse.json({ espacios });
  } catch (err) {
    return mapErrorToResponse(err);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "validation", message: "El cuerpo de la petición no es JSON válido" }, { status: 400 });
  }
  const espacioIds: string[] = Array.isArray(body.espacioIds) ? body.espacioIds : [];

  try {
    const espacios = await setEspaciosDeUsuario(id, espacioIds, session);
    return NextResponse.json({ espacios });
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
