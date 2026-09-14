import { prisma } from "@/lib/db";
import { requireEspacioAdmin, scopeProyectoWhere } from "@/lib/auth";
import type { CreateProyectoInput, UpdateProyectoInput, ProyectoWithMetrics, ProyectoWithEspacio } from "@/types/proyecto";
import type { SessionData, UsuarioActual } from "@/lib/auth";

/**
 * Create a new proyecto within an espacio.
 * Requires superadmin, or admin del espacio destino.
 */
export async function createProyecto(
  input: CreateProyectoInput,
  session: SessionData
) {
  const { espacioId: espacioIdInput } = input;

  if (!espacioIdInput || typeof espacioIdInput !== "string" || espacioIdInput.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "espacioId is required" } };
  }

  await requireEspacioAdmin(session, espacioIdInput.trim());

  const { nombre, ambiente, espacioId, color } = input;

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
      color: color?.trim() || null,
    },
  });

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    ambiente: proyecto.ambiente,
    color: proyecto.color,
    espacioId: proyecto.espacioId,
    createdAt: proyecto.createdAt,
    updatedAt: proyecto.updatedAt,
  };
}

/**
 * List all active proyectos for a given espacio. Si se pasa `usuario`, se
 * filtra además por su alcance (relevante para tester: solo sus proyectos
 * asignados dentro de ese espacio).
 */
export async function listProyectosByEspacio(espacioId: string, usuario?: UsuarioActual | null) {
  return prisma.proyecto.findMany({
    where: {
      espacioId,
      activo: true,
      ...(usuario ? scopeProyectoWhere(usuario) : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * List all active proyectos with their espacio included. Si se pasa
 * `usuario`, se filtra por su alcance (superadmin: todos; admin: los de sus
 * espacios; tester: solo los asignados).
 */
export async function listProyectosActivos(usuario?: UsuarioActual | null): Promise<ProyectoWithEspacio[]> {
  return prisma.proyecto.findMany({
    where: {
      activo: true,
      ...(usuario ? scopeProyectoWhere(usuario) : {}),
    },
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
    descripcion: proyecto.descripcion,
    versionSistema: proyecto.versionSistema,
    color: proyecto.color,
    activo: proyecto.activo,
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
  // Check proyecto exists
  const existing = await prisma.proyecto.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  // Requires superadmin, o admin del espacio dueño del proyecto
  await requireEspacioAdmin(session, existing.espacioId);

  const updateData: UpdateProyectoInput = {};
  if (input.nombre !== undefined) {
    updateData.nombre = input.nombre.trim();
  }
  if (input.ambiente !== undefined) {
    updateData.ambiente = input.ambiente.trim();
  }
  if (input.versionSistema !== undefined) {
    updateData.versionSistema = input.versionSistema?.trim() || null;
  }
  if (input.descripcion !== undefined) {
    updateData.descripcion = input.descripcion?.trim() || null;
  }
  if (input.color !== undefined) {
    updateData.color = input.color?.trim() || null;
  }
  if (input.activo !== undefined) {
    updateData.activo = input.activo;
  }

  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: updateData,
  });

  return {
    id: proyecto.id,
    nombre: proyecto.nombre,
    ambiente: proyecto.ambiente,
    descripcion: proyecto.descripcion,
    versionSistema: proyecto.versionSistema,
    color: proyecto.color,
    activo: proyecto.activo,
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
  // Check proyecto exists
  const existing = await prisma.proyecto.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  // Requires superadmin, o admin del espacio dueño del proyecto
  await requireEspacioAdmin(session, existing.espacioId);

  await prisma.proyecto.update({
    where: { id },
    data: { activo: false },
  });

  return { success: true };
}

/**
 * Asigna un tester ya existente a un Proyecto. Requiere superadmin o admin
 * del espacio dueño del proyecto. El usuario destino debe tener rol tester.
 */
export async function asignarTesterProyecto(proyectoId: string, usuarioId: string, session: SessionData) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
  if (!proyecto) {
    throw { status: 404, body: { error: "not_found" } };
  }

  await requireEspacioAdmin(session, proyecto.espacioId);

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    throw { status: 404, body: { error: "not_found", message: "usuario no existe" } };
  }
  if (usuario.rol !== "tester") {
    throw { status: 400, body: { error: "validation", message: "solo se pueden asignar usuarios con rol tester" } };
  }

  await prisma.usuarioProyecto.upsert({
    where: { usuarioId_proyectoId: { usuarioId, proyectoId } },
    create: { usuarioId, proyectoId },
    update: {},
  });

  return { success: true };
}

/**
 * Quita el acceso de un tester a un Proyecto. Requiere superadmin o admin
 * del espacio dueño del proyecto.
 */
export async function quitarTesterProyecto(proyectoId: string, usuarioId: string, session: SessionData) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
  if (!proyecto) {
    throw { status: 404, body: { error: "not_found" } };
  }

  await requireEspacioAdmin(session, proyecto.espacioId);

  await prisma.usuarioProyecto.deleteMany({
    where: { usuarioId, proyectoId },
  });

  return { success: true };
}

/**
 * Lista los testers con acceso a un Proyecto. Requiere superadmin o admin
 * del espacio dueño del proyecto.
 */
export async function listTestersProyecto(proyectoId: string, session: SessionData) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } });
  if (!proyecto) {
    throw { status: 404, body: { error: "not_found" } };
  }

  await requireEspacioAdmin(session, proyecto.espacioId);

  const accesos = await prisma.usuarioProyecto.findMany({
    where: { proyectoId },
    include: { usuario: { select: { id: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return accesos.map((a) => ({ id: a.usuario.id, email: a.usuario.email, asignadoDesde: a.createdAt }));
}
