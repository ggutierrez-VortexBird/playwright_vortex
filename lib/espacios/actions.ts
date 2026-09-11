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
