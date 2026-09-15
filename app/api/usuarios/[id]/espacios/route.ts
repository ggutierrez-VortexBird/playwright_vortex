import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listEspaciosDeUsuario, setEspaciosDeUsuario } from "@/lib/usuarios/actions";

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
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const espacioIds: string[] = Array.isArray(body.espacioIds) ? body.espacioIds : [];

  try {
    const espacios = await setEspaciosDeUsuario(id, espacioIds, session);
    return NextResponse.json({ espacios });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
