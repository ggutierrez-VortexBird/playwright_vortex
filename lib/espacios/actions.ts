import { prisma } from "@/lib/db";
import { requireSuperadmin, scopeEspacioWhere } from "@/lib/auth";
import type { SessionData, UsuarioActual } from "@/lib/auth";
import type { CreateEspacioInput, UpdateEspacioInput } from "@/types/espacio";

/**
 * Lista Espacios activos. Si se pasa `usuario`, se filtra por su alcance
 * (superadmin: todos; admin: solo los que administra; tester: ninguno).
 * Sin `usuario` devuelve todos (uso interno/legacy).
 */
export async function listEspacios(usuario?: UsuarioActual | null) {
  return prisma.espacio.findMany({
    where: {
      activo: true,
      ...(usuario ? scopeEspacioWhere(usuario) : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export interface EspacioMetrics {
  proyectoCount: number;
  totalCasos: number;
  casosConformes: number;
  casosNoConformes: number;
  tasaExito: number | null;
  ultimaActividad: string | null;
  miembros: { id: string; email: string }[];
}

/**
 * Rollup de métricas por espacio para las cards de /espacios: proyectos,
 * casos, tasa de éxito agregada (basada en la última ejecución de cada
 * caso, igual criterio que getMetrics de proyectos) y miembros (admins
 * asignados vía UsuarioEspacio). Todo en un puñado de queries batched,
 * sin N+1 por espacio.
 */
export async function getEspaciosMetrics(espacioIds: string[]): Promise<Record<string, EspacioMetrics>> {
  const metrics: Record<string, EspacioMetrics> = {};
  for (const id of espacioIds) {
    metrics[id] = {
      proyectoCount: 0,
      totalCasos: 0,
      casosConformes: 0,
      casosNoConformes: 0,
      tasaExito: null,
      ultimaActividad: null,
      miembros: [],
    };
  }
  if (espacioIds.length === 0) return metrics;

  const proyectos = await prisma.proyecto.findMany({
    where: { activo: true, espacioId: { in: espacioIds } },
    select: { id: true, espacioId: true },
  });
  const proyectoIdToEspacioId = new Map(proyectos.map((p) => [p.id, p.espacioId]));
  for (const p of proyectos) {
    metrics[p.espacioId].proyectoCount += 1;
  }

  const proyectoIds = proyectos.map((p) => p.id);
  const casos = proyectoIds.length
    ? await prisma.casoPrueba.findMany({
        where: { activo: true, proyectoId: { in: proyectoIds } },
        select: { id: true, proyectoId: true },
      })
    : [];
  const casoIdToEspacioId = new Map<string, string>();
  for (const c of casos) {
    const espacioId = proyectoIdToEspacioId.get(c.proyectoId);
    if (!espacioId) continue;
    casoIdToEspacioId.set(c.id, espacioId);
    metrics[espacioId].totalCasos += 1;
  }

  const casoIds = casos.map((c) => c.id);
  const ejecuciones = casoIds.length
    ? await prisma.ejecucion.findMany({
        where: { casoPruebaId: { in: casoIds }, finAt: { not: null } },
        orderBy: { finAt: "desc" },
        select: { casoPruebaId: true, estado: true, finAt: true },
      })
    : [];

  const latestByCaso = new Map<string, (typeof ejecuciones)[number]>();
  for (const e of ejecuciones) {
    if (!latestByCaso.has(e.casoPruebaId)) latestByCaso.set(e.casoPruebaId, e);
  }

  const ultimaActividad: Record<string, Date> = {};
  for (const e of latestByCaso.values()) {
    const espacioId = casoIdToEspacioId.get(e.casoPruebaId);
    if (!espacioId) continue;
    if (e.estado === "paso") metrics[espacioId].casosConformes += 1;
    if (e.estado === "fallo") metrics[espacioId].casosNoConformes += 1;
    if (e.finAt && (!ultimaActividad[espacioId] || e.finAt > ultimaActividad[espacioId])) {
      ultimaActividad[espacioId] = e.finAt;
    }
  }
  for (const [espacioId, fecha] of Object.entries(ultimaActividad)) {
    metrics[espacioId].ultimaActividad = fecha.toISOString();
  }
  for (const m of Object.values(metrics)) {
    const evaluados = m.casosConformes + m.casosNoConformes;
    m.tasaExito = evaluados > 0 ? Math.round((m.casosConformes / evaluados) * 100) : null;
  }

  const membresias = await prisma.usuarioEspacio.findMany({
    where: { espacioId: { in: espacioIds } },
    include: { usuario: { select: { id: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  for (const m of membresias) {
    metrics[m.espacioId].miembros.push(m.usuario);
  }

  return metrics;
}

export async function createEspacio(input: CreateEspacioInput, session: SessionData) {
  await requireSuperadmin(session);

  const { nombre, color } = input;

  if (!nombre || typeof nombre !== "string" || nombre.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "nombre is required" } };
  }

  if (!color || typeof color !== "string" || color.trim() === "") {
    throw { status: 400, body: { error: "validation", message: "color is required" } };
  }

  return prisma.espacio.create({
    data: {
      nombre: nombre.trim(),
      color: color.trim(),
    },
  });
}

export async function getEspacioById(id: string) {
  return prisma.espacio.findUnique({
    where: { id },
  });
}

export async function updateEspacio(id: string, input: UpdateEspacioInput, session: SessionData) {
  await requireSuperadmin(session);

  const existing = await prisma.espacio.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const updateData: UpdateEspacioInput = {};
  if (input.nombre !== undefined) {
    updateData.nombre = input.nombre.trim();
  }
  if (input.color !== undefined) {
    updateData.color = input.color.trim();
  }

  return prisma.espacio.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteEspacio(id: string, session: SessionData) {
  await requireSuperadmin(session);

  const existing = await prisma.espacio.findUnique({
    where: { id },
  });

  if (!existing) {
    throw { status: 404, body: { error: "not_found" } };
  }

  // Check if there are any active proyectos for this espacio
  const proyectosActivos = await prisma.proyecto.count({
    where: { espacioId: id, activo: true },
  });

  if (proyectosActivos > 0) {
    throw { status: 409, body: { error: "conflict", message: "hay proyectos activos" } };
  }

  await prisma.espacio.update({
    where: { id },
    data: { activo: false },
  });

  return { success: true };
}

/**
 * Asigna a un usuario (rol admin) como administrador de un Espacio.
 * Requiere superadmin.
 */
export async function asignarAdminEspacio(espacioId: string, usuarioId: string, session: SessionData) {
  await requireSuperadmin(session);

  const espacio = await prisma.espacio.findUnique({ where: { id: espacioId } });
  if (!espacio) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    throw { status: 404, body: { error: "not_found", message: "usuario no existe" } };
  }
  if (usuario.rol !== "admin") {
    throw { status: 400, body: { error: "validation", message: "solo se pueden asignar usuarios con rol admin" } };
  }

  await prisma.usuarioEspacio.upsert({
    where: { usuarioId_espacioId: { usuarioId, espacioId } },
    create: { usuarioId, espacioId },
    update: {},
  });

  return { success: true };
}

/**
 * Quita a un usuario como administrador de un Espacio. Requiere superadmin.
 */
export async function quitarAdminEspacio(espacioId: string, usuarioId: string, session: SessionData) {
  await requireSuperadmin(session);

  await prisma.usuarioEspacio.deleteMany({
    where: { usuarioId, espacioId },
  });

  return { success: true };
}

/**
 * Lista los admins asignados a un Espacio. Requiere superadmin.
 */
export async function listAdminsEspacio(espacioId: string, session: SessionData) {
  await requireSuperadmin(session);

  const membresias = await prisma.usuarioEspacio.findMany({
    where: { espacioId },
    include: { usuario: { select: { id: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return membresias.map((m) => ({ id: m.usuario.id, email: m.usuario.email, asignadoDesde: m.createdAt }));
}
