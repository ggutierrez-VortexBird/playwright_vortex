import { NextResponse } from "next/server";
import { getSession, requireEspacioAdmin } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/http/errors";
import { leerJson } from "@/lib/http/body";
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
    const espacio = await updateEspacio(id, body, session);
    return NextResponse.json(espacio);
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
    const result = await deleteEspacio(id, session);
    // 204 No Content no permite body — devolvemos 200 con el resultado
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return mapErrorToResponse(err);
  }
}
