import { NextResponse } from "next/server";
import { getSession, requireEspacioAdmin, FORBIDDEN_ERROR } from "@/lib/auth";
import { getEspacioById, updateEspacio, deleteEspacio } from "@/lib/espacios/actions";

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
    // Igual que el flujo /espacios/[id]/proyectos: solo superadmin o el
    // admin de este espacio pueden ver su detalle vía API.
    await requireEspacioAdmin(session, id);
    const espacio = await getEspacioById(id);
    if (!espacio) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 }
      );
    }
    return NextResponse.json(espacio);
  } catch (err: any) {
    if (err === FORBIDDEN_ERROR || err?.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
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
    const espacio = await updateEspacio(id, body, session);
    return NextResponse.json(espacio);
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
    const result = await deleteEspacio(id, session);
    // 204 No Content no permite body — devolvemos 200 con el resultado
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
