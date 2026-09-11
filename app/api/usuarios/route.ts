import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listUsuarios, createUsuario } from "@/lib/usuarios/actions";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const usuarios = await listUsuarios(session);
    return NextResponse.json({ usuarios });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const usuario = await createUsuario(body, session);
    return NextResponse.json({ usuario }, { status: 201 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
