import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { cambiarPasswordPropia } from "@/lib/perfil/actions";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();

  try {
    const result = await cambiarPasswordPropia(body.actual, body.nueva, session);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
