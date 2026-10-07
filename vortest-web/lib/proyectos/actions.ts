import { prisma } from "@/lib/db";
import { requireEspacioAdmin, requireProyectoAccess, scopeProyectoWhere } from "@/lib/auth";
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
// `null` = sesión sin usuario activo (borrado o desactivado): nunca listar sin filtro; `undefined` queda para usos internos sin alcance.
export async function listProyectosByEspacio(espacioId: string, usuario?: UsuarioActual | null) {
  if (usuario === null) return [];
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
 * Aplica `requireProyectoAccess` internamente (EST-02): ningún llamador puede
 * olvidarse del guard. Lanza FORBIDDEN_ERROR / NOT_FOUND_ERROR.
 */
export async function getProyectoById(id: string, session: SessionData): Promise<ProyectoWithMetrics> {
  await requireProyectoAccess(session, id);

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

export interface MetricasProyecto {
  totalCasos: number;
  casosConformes: number;
  casosNoConformes: number;
  fechaUltimaEjecucion: string | null;
}

/**
 * Métricas de varios proyectos con dos consultas en total (antes eran dos por proyecto y traían filas completas):
 * casos activos y la ejecución terminada más reciente de cada caso.
 */
export async function getMetricsLote(proyectoIds: string[]): Promise<Map<string, MetricasProyecto>> {
  const resultado = new Map<string, MetricasProyecto>(
    proyectoIds.map((id) => [id, { totalCasos: 0, casosConformes: 0, casosNoConformes: 0, fechaUltimaEjecucion: null }]),
  );
  if (proyectoIds.length === 0) return resultado;

  const casos = await prisma.casoPrueba.findMany({
    where: { proyectoId: { in: proyectoIds }, activo: true },
    select: { id: true, proyectoId: true },
  });
  const proyectoDeCaso = new Map<string, string>();
  for (const c of casos as { id: string; proyectoId?: string }[]) {
    const pid = c.proyectoId ?? (proyectoIds.length === 1 ? proyectoIds[0] : undefined);
    if (!pid) continue;
    proyectoDeCaso.set(c.id, pid);
    resultado.get(pid)!.totalCasos++;
  }
  if (proyectoDeCaso.size === 0) return resultado;

  const ejecuciones = await prisma.ejecucion.findMany({
    where: { casoPruebaId: { in: [...proyectoDeCaso.keys()] }, finAt: { not: null } },
    orderBy: { finAt: "desc" },
    select: { casoPruebaId: true, estado: true, finAt: true },
  });
  const vistos = new Set<string>();
  for (const e of ejecuciones) {
    if (vistos.has(e.casoPruebaId)) continue;
    vistos.add(e.casoPruebaId);
    const m = resultado.get(proyectoDeCaso.get(e.casoPruebaId)!);
    if (!m) continue;
    if (e.estado === "paso") m.casosConformes++;
    else if (e.estado === "fallo") m.casosNoConformes++;
    const fecha = e.finAt?.toISOString() ?? null;
    if (fecha && (!m.fechaUltimaEjecucion || fecha > m.fechaUltimaEjecucion)) m.fechaUltimaEjecucion = fecha;
  }
  return resultado;
}

export async function getMetrics(proyectoId: string): Promise<MetricasProyecto> {
  return (await getMetricsLote([proyectoId])).get(proyectoId)!;
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
