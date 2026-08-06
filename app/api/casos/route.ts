import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCasos, createCaso } from "@/lib/casos/actions";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const proyectoId = url.searchParams.get("proyectoId") || undefined;

  const casos = await listCasos(proyectoId);

  return NextResponse.json({ casos });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const body = await request.json();

  try {
    const caso = await createCaso(body, session);
    return NextResponse.json(caso, { status: 201 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
