import { NextResponse } from "next/server";
import { getSession, requireSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  try {
    await requireSuperadmin(session);

    const usuarios = await prisma.usuario.findMany({
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    });

    return NextResponse.json({ usuarios });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
