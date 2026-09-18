import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { requireSuperadmin, getUsuarioActual } from "@/lib/auth";
import type { SessionData, RolUsuario } from "@/lib/auth";

export interface CreateUsuarioInput {
  email: string;
  password: string;
  rol?: RolUsuario;
}

const ROLES_CREABLES: RolUsuario[] = ["admin", "tester"];

const USUARIO_LIST_SELECT = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  activo: true,
  ultimoAccesoAt: true,
  createdAt: true,
  espacios: {
    select: { espacio: { select: { id: true, nombre: true } } },
  },
} as const;

function serializeUsuario(u: {
  id: string;
  email: string;
  nombre: string | null;
  rol: RolUsuario;
  activo: boolean;
  ultimoAccesoAt: Date | null;
  createdAt: Date;
  espacios?: { espacio: { id: string; nombre: string } }[];
}) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    activo: u.activo,
    ultimoAccesoAt: u.ultimoAccesoAt ? u.ultimoAccesoAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    espacios: (u.espacios ?? []).map((e) => e.espacio),
  };
}

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

  const passwordHash = await hashPassword(input.password);

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
 * - admin: él mismo, más los testers asignados a un proyecto de alguno de
 *   los espacios que administra (nunca otros admins ni superadmins, y
 *   nunca testers de espacios ajenos).
 * - tester: solo él mismo.
 */
export async function listUsuarios(session: SessionData) {
  const actor = await getUsuarioActual(session);
  if (!actor) {
    throw { status: 403, body: { error: "forbidden" } };
  }

  if (actor.rol === "superadmin") {
    const usuarios = await prisma.usuario.findMany({
      select: USUARIO_LIST_SELECT,
      orderBy: { email: "asc" },
    });
    return usuarios.map(serializeUsuario);
  }

  if (actor.rol === "admin") {
    const usuarios = await prisma.usuario.findMany({
      where: {
        OR: [
          { id: actor.id },
          {
            rol: "tester",
            proyectos: {
              some: {
                proyecto: {
                  espacio: { miembros: { some: { usuarioId: actor.id } } },
                },
              },
            },
          },
        ],
      },
      select: USUARIO_LIST_SELECT,
      orderBy: { email: "asc" },
    });
    return usuarios.map(serializeUsuario);
  }

  // tester
  const propio = await prisma.usuario.findUnique({
    where: { id: actor.id },
    select: USUARIO_LIST_SELECT,
  });
  return propio ? [serializeUsuario(propio)] : [];
}

export interface UpdateUsuarioRolEstadoInput {
  rol?: RolUsuario;
  activo?: boolean;
}

/**
 * Edita el rol y/o el estado (activo/suspendido) de OTRO usuario.
 * - superadmin: puede tocar admin/tester (nunca a otro superadmin ni
 *   ponerle rol superadmin a nadie — eso solo lo hace el seed).
 * - admin: solo puede tocar usuarios con rol tester, y solo el campo
 *   `activo` (no puede cambiarles el rol).
 * - Nadie puede editarse a sí mismo desde acá — es autogestión (/perfil).
 */
export async function updateUsuarioRolEstado(
  usuarioId: string,
  input: UpdateUsuarioRolEstadoInput,
  session: SessionData,
) {
  const actor = await getUsuarioActual(session);
  if (!actor || actor.rol === "tester") {
    throw { status: 403, body: { error: "forbidden" } };
  }
  if (usuarioId === actor.id) {
    throw { status: 400, body: { error: "validation", message: "no puedes editar tu propia cuenta aquí — usa tu perfil" } };
  }

  const target = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!target) {
    throw { status: 404, body: { error: "not_found" } };
  }

  if (actor.rol === "admin") {
    if (target.rol !== "tester") {
      throw { status: 403, body: { error: "forbidden" } };
    }
    if (input.rol && input.rol !== "tester") {
      throw { status: 403, body: { error: "forbidden", message: "un admin no puede cambiar roles" } };
    }
    const usuario = await prisma.usuario.update({
      where: { id: usuarioId },
      data: { activo: input.activo },
      select: USUARIO_LIST_SELECT,
    });
    return serializeUsuario(usuario);
  }

  // superadmin
  if (target.rol === "superadmin") {
    throw { status: 403, body: { error: "forbidden", message: "no se puede editar a otro superadmin" } };
  }
  if (input.rol && !ROLES_CREABLES.includes(input.rol)) {
    throw { status: 400, body: { error: "validation", message: "rol debe ser admin o tester" } };
  }

  const usuario = await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      ...(input.rol ? { rol: input.rol } : {}),
      ...(input.activo !== undefined ? { activo: input.activo } : {}),
    },
    select: USUARIO_LIST_SELECT,
  });
  return serializeUsuario(usuario);
}

/**
 * Espacios que administra un usuario (usuario-céntrico — la contraparte de
 * `listAdminsEspacio`, que es espacio-céntrico). Solo tiene sentido para
 * usuarios con rol admin. Requiere superadmin.
 */
export async function listEspaciosDeUsuario(usuarioId: string, session: SessionData) {
  await requireSuperadmin(session);

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    throw { status: 404, body: { error: "not_found" } };
  }

  const filas = await prisma.usuarioEspacio.findMany({
    where: { usuarioId },
    include: { espacio: { select: { id: true, nombre: true, color: true } } },
    orderBy: { createdAt: "asc" },
  });

  return filas.map((f) => f.espacio);
}

/**
 * Reemplaza el conjunto completo de espacios que administra un usuario.
 * Solo aplica a usuarios con rol admin (misma regla que
 * `asignarAdminEspacio`: "solo se pueden asignar usuarios con rol admin").
 * Requiere superadmin.
 */
export async function setEspaciosDeUsuario(usuarioId: string, espacioIds: string[], session: SessionData) {
  await requireSuperadmin(session);

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    throw { status: 404, body: { error: "not_found" } };
  }
  if (usuario.rol !== "admin") {
    throw { status: 400, body: { error: "validation", message: "solo se pueden asignar espacios a usuarios con rol admin" } };
  }

  await prisma.$transaction([
    prisma.usuarioEspacio.deleteMany({ where: { usuarioId } }),
    ...(espacioIds.length > 0
      ? [
          prisma.usuarioEspacio.createMany({
            data: espacioIds.map((espacioId) => ({ usuarioId, espacioId })),
            skipDuplicates: true,
          }),
        ]
      : []),
  ]);

  return listEspaciosDeUsuario(usuarioId, session);
}
