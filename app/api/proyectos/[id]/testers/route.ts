import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { asignarTesterProyecto, quitarTesterProyecto, listTestersProyecto } from "@/lib/proyectos/actions";

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
    const testers = await listTestersProyecto(id, session);
    return NextResponse.json({ testers });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const result = await asignarTesterProyecto(id, body.usuarioId, session);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const usuarioId = searchParams.get("usuarioId");

  if (!usuarioId) {
    return NextResponse.json({ error: "validation", message: "usuarioId es requerido" }, { status: 400 });
  }

  try {
    const result = await quitarTesterProyecto(id, usuarioId, session);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
