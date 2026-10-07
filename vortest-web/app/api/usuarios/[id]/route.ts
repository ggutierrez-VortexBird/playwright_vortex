import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateUsuarioRolEstado } from "@/lib/usuarios/actions";
import { mapErrorToResponse } from "@/lib/http/errors";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "validation", message: "El cuerpo de la petición no es JSON válido" }, { status: 400 });
  }

  try {
    const usuario = await updateUsuarioRolEstado(id, body, session);
    return NextResponse.json({ usuario });
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
