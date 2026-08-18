import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCasoById, updateCaso, deleteCaso } from "@/lib/casos/actions";

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
    const caso = await getCasoById(id);
    return NextResponse.json(caso);
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
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const formData = await request.formData();
    const scriptFile = formData.get("scriptFile") as File | null;

    const updateData: any = {};

    const codigo = formData.get("codigo");
    if (codigo !== null) updateData.codigo = codigo as string;

    const nombre = formData.get("nombre");
    if (nombre !== null) updateData.nombre = nombre as string;

    const responsableId = formData.get("responsableId");
    if (responsableId !== null) updateData.responsableId = responsableId as string;

    const proyectoId = formData.get("proyectoId");
    if (proyectoId !== null) updateData.proyectoId = proyectoId as string;

    if (scriptFile) {
      const fileName = scriptFile.name;
      const lowerName = fileName.toLowerCase();
      const isValidExt = [".spec.ts", ".test.ts", ".spec.js", ".test.js"].some((ext) =>
        lowerName.endsWith(ext)
      );
      if (!isValidExt) {
        return NextResponse.json(
          { error: "validation", message: "El archivo debe ser .spec.ts, .test.ts, .spec.js o .test.js" },
          { status: 400 }
        );
      }
      updateData.script = await scriptFile.text();
      updateData.scriptFileName = fileName;
    }

    const caso = await updateCaso(id, updateData, session);
    return NextResponse.json(caso);
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
    await deleteCaso(id, session);
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
