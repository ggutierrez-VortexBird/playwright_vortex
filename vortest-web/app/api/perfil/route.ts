import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { actualizarNombrePropio } from "@/lib/perfil/actions";
import { mapErrorToResponse } from "@/lib/http/errors";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "validation", message: "El cuerpo de la petición no es JSON válido" }, { status: 400 });
  }

  if (typeof body?.nombre !== "string") {
    return NextResponse.json(
      { error: "validation", message: "Escribe tu nombre" },
      { status: 400 }
    );
  }

  try {
    const usuario = await actualizarNombrePropio(body.nombre, session);
    return NextResponse.json({ usuario });
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
