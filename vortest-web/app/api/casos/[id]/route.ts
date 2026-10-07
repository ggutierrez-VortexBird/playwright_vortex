import { NextResponse } from "next/server";
import { getCasoById, updateCaso, deleteCaso } from "@/lib/casos/actions";
import { withAuth } from "@/lib/http/with-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const GET = withAuth<RouteParams>(async (_request, { params }, session) => {
  const { id } = await params;

  // getCasoById aplica requireProyectoAccess internamente (EST-02).
  const caso = await getCasoById(id, session);
  return NextResponse.json(caso);
});

export const PUT = withAuth<RouteParams>(async (request, { params }, session) => {
  const { id } = await params;

  const formData = await request.formData();
  const scriptFile = formData.get("scriptFile") as File | null;

  const updateData: Record<string, string> = {};

  const codigo = formData.get("codigo");
  if (codigo !== null) updateData.codigo = codigo as string;

  const nombre = formData.get("nombre");
  if (nombre !== null) updateData.nombre = nombre as string;

  const responsableId = formData.get("responsableId");
  if (responsableId !== null) updateData.responsableId = responsableId as string;

  const proyectoId = formData.get("proyectoId");
  if (proyectoId !== null) updateData.proyectoId = proyectoId as string;

  const parentCaseId = formData.get("parentCaseId");
  if (parentCaseId !== null) updateData.parentCaseId = parentCaseId as string;

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
  } else {
    // Edición directa del script desde el editor del detalle de caso
    // (sin reemplazar el archivo completo). Solo se toma si no vino un
    // archivo — subir un archivo siempre gana.
    const script = formData.get("script");
    if (typeof script === "string") {
      updateData.script = script;
    }
  }

  const caso = await updateCaso(id, updateData, session);
  return NextResponse.json(caso);
});

export const DELETE = withAuth<RouteParams>(async (_request, { params }, session) => {
  const { id } = await params;

  await deleteCaso(id, session);
  return new NextResponse(null, { status: 204 });
});
