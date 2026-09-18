import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { actualizarNombrePropio } from "@/lib/perfil/actions";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();

  if (typeof body?.nombre !== "string") {
    return NextResponse.json(
      { error: "validation", message: "nombre is required" },
      { status: 400 }
    );
  }

  try {
    const usuario = await actualizarNombrePropio(body.nombre, session);
    return NextResponse.json({ usuario });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
