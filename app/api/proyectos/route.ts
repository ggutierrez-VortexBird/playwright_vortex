import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listProyectosByEspacio, createProyecto, getMetrics } from "@/lib/proyectos/actions";

export async function GET(request: Request) {
  const session = await getSession();

  if (!session.userId) {
    return NextResponse.json(
      { error: "No autenticado" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const espacioId = url.searchParams.get("espacioId");

  if (!espacioId) {
    return NextResponse.json(
      { error: "validation", message: "espacioId is required" },
      { status: 400 }
    );
  }

  const proyectos = await listProyectosByEspacio(espacioId);

  // Enrich with metrics
  const proyectosWithMetrics = await Promise.all(
    proyectos.map(async (proyecto) => {
      const metrics = await getMetrics(proyecto.id);
      return {
        id: proyecto.id,
        nombre: proyecto.nombre,
        ambiente: proyecto.ambiente,
        espacioId: proyecto.espacioId,
        totalCasos: metrics.totalCasos,
        casosConformes: metrics.casosConformes,
        casosNoConformes: metrics.casosNoConformes,
        fechaUltimaEjecucion: metrics.fechaUltimaEjecucion,
      };
    })
  );

  return NextResponse.json({ proyectos: proyectosWithMetrics });
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
    const proyecto = await createProyecto(body, session);
    return NextResponse.json(proyecto, { status: 201 });
  } catch (err: any) {
    if (err.status) {
      return NextResponse.json(err.body, { status: err.status });
    }
    throw err;
  }
}
