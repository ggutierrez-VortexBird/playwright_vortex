import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireSuperadmin, getUsuarioActual } from "@/lib/auth";
import type { SessionData, RolUsuario } from "@/lib/auth";

export interface CreateUsuarioInput {
  email: string;
  password: string;
  rol?: RolUsuario;
}

const ROLES_CREABLES: RolUsuario[] = ["admin", "tester"];

/**
 * Crea un usuario nuevo.
 * - superadmin puede crearlo con rol `admin` o `tester`.
 * - admin solo puede crearlo con rol `tester` (se fuerza sin importar lo
 *   que pida el body).
 * - tester no puede crear usuarios.
 */
export async function createUsuario(input: CreateUsuarioInput, session: SessionData) {
  const actor = await getUsuarioActual(session);
  if (!actor || actor.rol === "tester") {
    throw { status: 403, body: { error: "forbidden" } };
  }

  const email = input.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw { status: 400, body: { error: "validation", message: "email inválido" } };
  }

  if (!input.password || input.password.length < 8) {
    throw { status: 400, body: { error: "validation", message: "password debe tener al menos 8 caracteres" } };
  }

  let rol: RolUsuario = "tester";
  if (actor.rol === "superadmin") {
    if (input.rol && !ROLES_CREABLES.includes(input.rol)) {
      throw { status: 400, body: { error: "validation", message: "rol debe ser admin o tester" } };
    }
    rol = input.rol ?? "tester";
  }
  // admin: rol siempre queda en "tester", ignorando lo que pida el body.

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    throw { status: 409, body: { error: "conflict", message: "ya existe un usuario con ese email" } };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const usuario = await prisma.usuario.create({
    data: { email, passwordHash, rol },
    select: { id: true, email: true, rol: true, createdAt: true },
  });

  return usuario;
}

/**
 * Lista usuarios según el alcance de quien pregunta. Sirve tanto para la
 * página de gestión de usuarios como para el selector de "responsable" al
 * crear un caso (por eso siempre incluye al usuario que pregunta):
 * - superadmin: todos.
 * - admin: los usuarios con rol tester, más él mismo (para poder asignar
 *   proyectos/casos y también auto-asignarse como responsable).
 * - tester: solo él mismo.
 */
export async function listUsuarios(session: SessionData) {
  const actor = await getUsuarioActual(session);
  if (!actor) {
    throw { status: 403, body: { error: "forbidden" } };
  }

  if (actor.rol === "superadmin") {
    return prisma.usuario.findMany({
      select: { id: true, email: true, rol: true },
      orderBy: { email: "asc" },
    });
  }

  if (actor.rol === "admin") {
    return prisma.usuario.findMany({
      where: { OR: [{ rol: "tester" }, { id: actor.id }] },
      select: { id: true, email: true, rol: true },
      orderBy: { email: "asc" },
    });
  }

  // tester
  return [{ id: actor.id, email: actor.email, rol: actor.rol }];
}
