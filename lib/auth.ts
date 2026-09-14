import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export interface SessionData {
  userId?: string;
  email?: string;
}

export const sessionOptions = {
  cookieName: "vortest_session",
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 60 * 60 * 24,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function saveSession(userId: string, email: string) {
  const session = await getSession();
  session.userId = userId;
  session.email = email;
  await session.save();
}

export async function destroySession() {
  const session = await getSession();
  await session.destroy();
}

// Marker errors so route handlers can map them to HTTP responses
export const FORBIDDEN_ERROR = new Error("FORBIDDEN");
export const NOT_FOUND_ERROR = new Error("NOT_FOUND");

export type RolUsuario = "superadmin" | "admin" | "tester";

export interface UsuarioActual {
  id: string;
  email: string;
  rol: RolUsuario;
}

/**
 * Única consulta {id, email, rol} del usuario de la sesión actual.
 * Punto central de lectura de rol — evita repetir esta query en cada page.
 */
export async function getUsuarioActual(session: SessionData): Promise<UsuarioActual | null> {
  if (!session.userId) {
    return null;
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, rol: true },
  });

  return usuario;
}

/**
 * Verify that the current session user has superadmin role.
 * Throws FORBIDDEN_ERROR if not authorized.
 */
export async function requireSuperadmin(session: SessionData): Promise<void> {
  const usuario = await getUsuarioActual(session);

  if (usuario?.rol !== "superadmin") {
    throw FORBIDDEN_ERROR;
  }
}

/**
 * Pasa si el usuario es superadmin, o si es admin con una fila
 * `UsuarioEspacio` para ese espacio (i.e. el superadmin se lo asignó).
 * Usado para gestionar Proyectos y para asignar/quitar testers — nunca
 * para editar el Espacio en sí (eso sigue siendo `requireSuperadmin`).
 */
export async function requireEspacioAdmin(session: SessionData, espacioId: string): Promise<void> {
  const usuario = await getUsuarioActual(session);
  if (!usuario) {
    throw FORBIDDEN_ERROR;
  }
  if (usuario.rol === "superadmin") {
    return;
  }
  if (usuario.rol !== "admin") {
    throw FORBIDDEN_ERROR;
  }

  const membresia = await prisma.usuarioEspacio.findUnique({
    where: { usuarioId_espacioId: { usuarioId: usuario.id, espacioId } },
  });
  if (!membresia) {
    throw FORBIDDEN_ERROR;
  }
}

/**
 * Pasa si el usuario es superadmin, admin del espacio dueño del proyecto, o
 * tester con una fila `UsuarioProyecto` para ese proyecto. Usado para CRUD
 * de Casos y Ejecuciones (los tres roles con acceso pueden operar), nunca
 * para editar el Proyecto en sí (eso usa `requireEspacioAdmin`).
 */
export async function requireProyectoAccess(session: SessionData, proyectoId: string): Promise<void> {
  const usuario = await getUsuarioActual(session);
  if (!usuario) {
    throw FORBIDDEN_ERROR;
  }
  if (usuario.rol === "superadmin") {
    return;
  }

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { espacioId: true },
  });
  if (!proyecto) {
    throw NOT_FOUND_ERROR;
  }

  if (usuario.rol === "admin") {
    const membresia = await prisma.usuarioEspacio.findUnique({
      where: { usuarioId_espacioId: { usuarioId: usuario.id, espacioId: proyecto.espacioId } },
    });
    if (!membresia) {
      throw FORBIDDEN_ERROR;
    }
    return;
  }

  // tester
  const acceso = await prisma.usuarioProyecto.findUnique({
    where: { usuarioId_proyectoId: { usuarioId: usuario.id, proyectoId } },
  });
  if (!acceso) {
    throw FORBIDDEN_ERROR;
  }
}

/**
 * Fragmento de `where` de Prisma para filtrar Espacios visibles por el
 * usuario actual: superadmin ve todo, admin solo los que administra, tester
 * ninguno (no tiene alcance a nivel Espacio).
 */
export function scopeEspacioWhere(usuario: UsuarioActual) {
  if (usuario.rol === "superadmin") {
    return {};
  }
  if (usuario.rol === "admin") {
    return { miembros: { some: { usuarioId: usuario.id } } };
  }
  return { id: "__sin-acceso__" };
}

/**
 * Fragmento de `where` de Prisma para filtrar Proyectos visibles por el
 * usuario actual: superadmin ve todo, admin los de sus espacios, tester
 * solo los que se le asignaron.
 */
export function scopeProyectoWhere(usuario: UsuarioActual) {
  if (usuario.rol === "superadmin") {
    return {};
  }
  if (usuario.rol === "admin") {
    return { espacio: { miembros: { some: { usuarioId: usuario.id } } } };
  }
  return { testers: { some: { usuarioId: usuario.id } } };
}
