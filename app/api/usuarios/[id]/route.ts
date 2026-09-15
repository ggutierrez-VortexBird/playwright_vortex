import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateUsuarioRolEstado } from "@/lib/usuarios/actions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const usuario = await updateUsuarioRolEstado(id, body, session);
    return NextResponse.json({ usuario });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
