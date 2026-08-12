import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/auth";
import type { CreateProyectoInput, UpdateProyectoInput, ProyectoWithMetrics, ProyectoWithEspacio } from "@/types/proyecto";
import type { SessionData } from "@/lib/auth";

/**
 * Create a new proyecto within an espacio.
 * Requires superadmin role.
 */
export async function createProyecto(
  input: CreateProyectoInput,
  session: SessionData
) {
  // Validate superadmin
  await requireSuperadmin(session);

  const { nombre, ambiente, espacioId } = input;

  // Validate required fields
  if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "nombre is required" } };
  }

  if (!ambiente || typeof ambiente !== "string" || ambiente.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "ambiente is required" } };
  }

  if (!espacioId || typeof espacioId !== "string" || espacioId.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "espacioId is required" } };
  }

  // Verify espacio exists
  const espacio = await prisma.espacio.findUnique({
    where: { id: espacioId },
  });

  if (!espacio) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const proyecto = await prisma.proyecto.create({
    data: {
      nombre: nombre.trim(),
      ambiente: ambiente.trim(),
      espacioId: espacioId.trim(),
    },
  });

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    ambiente: proyecto.ambiente,
    espacioId: proyecto.espacioId,
    createdAt: proyecto.createdAt,
    updatedAt: proyecto.updatedAt,
  };
}

/**
 * List all active proyectos for a given espacio.
 */
export async function listProyectosByEspacio(espacioId: string) {
  return prisma.proyecto.findMany({
    where: { espacioId, activo: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * List all active proyectos with their espacio included.
 */
export async function listProyectosActivos(): Promise<ProyectoWithEspacio[]> {
  return prisma.proyecto.findMany({
    where: { activo: true },
    include: { espacio: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get a single proyecto by ID with metrics from latest execution per caso.
 * Uses 3-query strategy to avoid N+1.
 */
export async function getProyectoById(id: string): Promise<ProyectoWithMetrics> {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id },
  });

  if (!proyecto) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const metrics = await getMetrics(id);

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    ambiente: proyecto.ambiente,
    espacioId: proyecto.espacioId,
    createdAt: proyecto.createdAt,
    updatedAt: proyecto.updatedAt,
    totalCasos: metrics.totalCasos,
    casosConformes: metrics.casosConformes,
    casosNoConformes: metrics.casosNoConformes,
    fechaUltimaEjecucion: metrics.fechaUltimaEjecucion,
  };
}

/**
 * Get metrics for a proyecto: totalCasos, casosConformes, casosNoConformes, fechaUltimaEjecucion.
 * Uses 2-query strategy:
 * 1. Get all active casos for the proyecto
 * 2. Get all executions for those casos (ordered by finAt desc), then dedup manually to get latest per caso
 */
export async function getMetrics(proyectoId: string): Promise<{
  totalCasos: number;
  casosConformes: number;
  casosNoConformes: number;
  fechaUltimaEjecucion: string | null;
}> {
  // Step 1: Get all active casos and collect their IDs
  const casos = await prisma.casoPrueba.findMany({
    where: { proyectoId, activo: true },
    select: { id: true },
  });
  const totalCasos = casos.length;
  const casoIds = casos.map((c) => c.id);

  if (casoIds.length === 0) {
    return {
      totalCasos: 0,
      casosConformes: 0,
      casosNoConformes: 0,
      fechaUltimaEjecucion: null,
    };
  }

  // Query 2: Get all executions for the casos (only completed ones), ordered by finAt desc
  const ejecuciones = await prisma.ejecucion.findMany({
    where: { casoPruebaId: { in: casoIds }, finAt: { not: null } },
    orderBy: { finAt: "desc" },
  });

  if (ejecuciones.length === 0) {
    return {
      totalCasos,
      casosConformes: 0,
      casosNoConformes: 0,
      fechaUltimaEjecucion: null,
    };
  }

  // Dedup: keep only the latest execution per caso (first occurrence due to orderBy desc)
  const latestByCaso = new Map<string, typeof ejecuciones[0]>();
  for (const e of ejecuciones) {
    if (!latestByCaso.has(e.casoPruebaId)) {
      latestByCaso.set(e.casoPruebaId, e);
    }
  }

  const latestEjecuciones = Array.from(latestByCaso.values());

  const casosConformes = latestEjecuciones.filter((e) => e.estado === "paso").length;
  const casosNoConformes = latestEjecuciones.filter((e) => e.estado === "fallo").length;

  // Get the latest finAt from the executions
  const fechas = latestEjecuciones
    .map((e) => e.finAt)
    .filter((f): f is Date => f !== null)
    .sort((a, b) => b.getTime() - a.getTime());

  const fechaUltimaEjecucion = fechas.length > 0 ? fechas[0].toISOString() : null;

  return {
    totalCasos,
    casosConformes,
    casosNoConformes,
    fechaUltimaEjecucion,
  };
}

/**
 * Update an existing proyecto.
 * Requires superadmin role.
 * Only updates fields that are provided.
 */
export async function updateProyecto(
  id: string,
  input: UpdateProyectoInput,
  session: SessionData
) {
  // Validate superadmin
  await requireSuperadmin(session);

  // Check proyecto exists
  const existing = await prisma.proyecto.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const updateData: UpdateProyectoInput = {};
  if (input.nombre !== undefined) {
    updateData.nombre = input.nombre.trim();
  }
  if (input.ambiente !== undefined) {
    updateData.ambiente = input.ambiente.trim();
  }

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: updateData,
  });

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    ambiente: proyecto.ambiente,
    espacioId: proyecto.espacioId,
    createdAt: proyecto.createdAt,
    updatedAt: proyecto.updatedAt,
  };
}

/**
 * Soft delete a proyecto (sets activo: false).
 * Requires superadmin role.
 */
export async function deleteProyecto(id: string, session: SessionData) {
  // Validate superadmin
  await requireSuperadmin(session);

  // Check proyecto exists
  const existing = await prisma.proyecto.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  await prisma.proyecto.update({
    where: { id },
    data: { activo: false },
  });

  return { success: true };
}
