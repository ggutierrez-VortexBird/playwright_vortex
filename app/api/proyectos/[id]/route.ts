import { NextResponse } from "next/server";
import { getSession, requireProyectoAccess, FORBIDDEN_ERROR, NOT_FOUND_ERROR } from "@/lib/auth";
import { getProyectoById, updateProyecto, deleteProyecto } from "@/lib/proyectos/actions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    await requireProyectoAccess(session, id);
    const proyecto = await getProyectoById(id);
    return NextResponse.json(proyecto);
  } catch (err: any) {
    if (err === FORBIDDEN_ERROR || err?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }
    if (err === NOT_FOUND_ERROR || err?.message === "NOT_FOUND") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;
  const body = await request.json();

  try {
    const proyecto = await updateProyecto(id, body, session);
    return NextResponse.json(proyecto);
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
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    await deleteProyecto(id, session);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
