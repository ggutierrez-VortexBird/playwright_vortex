import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listEspacios, createEspacio } from "@/lib/espacios/actions";

export async function GET() {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const espacios = await listEspacios();
  return NextResponse.json(espacios);
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
    const espacio = await createEspacio(body, session);
    return NextResponse.json(espacio, { status: 201 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
