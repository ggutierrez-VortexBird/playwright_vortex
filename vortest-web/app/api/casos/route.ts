import { NextResponse } from "next/server";
import { getUsuarioActual, requireProyectoAccess } from "@/lib/auth";
import { listCasos, createCaso, listParentCaseOptions } from "@/lib/casos/actions";
import { withAuth } from "@/lib/http/with-auth";

export const GET = withAuth(async (request, _ctx, session) => {
  const url = new URL(request.url);
  const proyectoId = url.searchParams.get("proyectoId") || undefined;
  const parentOptions = url.searchParams.get("parentOptions") === "true";
  const excludeId = url.searchParams.get("excludeId") || undefined;

  if (parentOptions) {
    if (!proyectoId) {
      return NextResponse.json(
        { error: "validation", message: "proyectoId requerido" },
        { status: 400 }
      );
    }
    await requireProyectoAccess(session, proyectoId);
    const options = await listParentCaseOptions(proyectoId, excludeId);
    return NextResponse.json({ options });
  }

  const usuario = await getUsuarioActual(session);
  const casos = await listCasos(proyectoId, usuario);

  return NextResponse.json({ casos });
});

export const POST = withAuth(async (request, _ctx, session) => {
  const formData = await request.formData();
  const scriptFile = formData.get("scriptFile") as File | null;
  const codigo = formData.get("codigo") as string;
  const nombre = formData.get("nombre") as string;
  const responsableId = formData.get("responsableId") as string;
  const proyectoId = formData.get("proyectoId") as string;
  const parentCaseId = formData.get("parentCaseId") as string | null;

  if (!scriptFile) {
    return NextResponse.json(
      { error: "validation", message: "Debes seleccionar un archivo de script" },
      { status: 400 }
    );
  }

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

  const script = await scriptFile.text();

  const caso = await createCaso(
    { codigo, nombre, script, scriptFileName: fileName, responsableId, proyectoId, parentCaseId },
    session
  );
  return NextResponse.json(caso, { status: 201 });
});
