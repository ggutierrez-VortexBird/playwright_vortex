import { NextResponse } from "next/server";
import { getSession, requireProyectoAccess } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/http/errors";
import { leerJson } from "@/lib/http/body";
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
    const proyecto = await getProyectoById(id, session);
    return NextResponse.json(proyecto);
  } catch (err) {
    return mapErrorToResponse(err);
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
  try {
    const body = await leerJson<Record<string, unknown>>(request);
    const proyecto = await updateProyecto(id, body, session);
    return NextResponse.json(proyecto);
  } catch (err) {
    return mapErrorToResponse(err);
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
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
