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

  try {
    const formData = await request.formData();
    const scriptFile = formData.get("scriptFile") as File | null;
    const codigo = formData.get("codigo") as string;
    const nombre = formData.get("nombre") as string;
    const responsableId = formData.get("responsableId") as string;
    const proyectoId = formData.get("proyectoId") as string;

    if (!scriptFile) {
      return NextResponse.json(
        { error: "validation", message: "Debes seleccionar un archivo de script" },
        { status: 400 }
      );
    }

    const fileName = scriptFile.name;
    const lowerName = fileName.toLowerCase();
    const isValidExt = [".spec.ts", ".test.ts", ".spec.js", ".test.js", ".ts", ".js"].some((ext) =>
      lowerName.endsWith(ext)
    );
    if (!isValidExt) {
      return NextResponse.json(
        { error: "validation", message: "El archivo debe ser .ts o .js" },
        { status: 400 }
      );
    }

    const script = await scriptFile.text();

    const caso = await createCaso(
      { codigo, nombre, script, scriptFileName: fileName, responsableId, proyectoId },
      session
    );
    return NextResponse.json(caso, { status: 201 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
