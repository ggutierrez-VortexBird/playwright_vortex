import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { SessionData } from "@/lib/auth";
import { getUsuarioActual } from "@/lib/auth";

/**
 * Acciones de autogestión de cuenta: a diferencia de `lib/usuarios/actions.ts`
 * (que gestiona a OTROS usuarios y requiere rol admin/superadmin), estas
 * funciones operan siempre sobre `session.userId` — nunca reciben un `id` de
 * la URL, así que no necesitan guard de rol.
 */

export async function actualizarNombrePropio(nombre: string, session: SessionData) {
  const actor = await getUsuarioActual(session);
  if (!actor) {
    throw { status: 401, body: { error: "no autenticado" } };
  }

  const nombreLimpio = nombre.trim();
  if (nombreLimpio.length < 2 || nombreLimpio.length > 100) {
    throw { status: 400, body: { error: "validation", message: "el nombre debe tener entre 2 y 100 caracteres" } };
  }

  const usuario = await prisma.usuario.update({
    where: { id: actor.id },
    data: { nombre: nombreLimpio },
    select: { id: true, email: true, nombre: true, rol: true },
  });

  return usuario;
}

export async function cambiarPasswordPropia(actual: string, nueva: string, session: SessionData) {
  const actor = await getUsuarioActual(session);
  if (!actor) {
    throw { status: 401, body: { error: "no autenticado" } };
  }

  if (!nueva || nueva.length < 8) {
    throw { status: 400, body: { error: "validation", message: "la nueva contraseña debe tener al menos 8 caracteres" } };
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: actor.id } });
  if (!usuario) {
    throw { status: 401, body: { error: "no autenticado" } };
  }

  const esValida = await verifyPassword(actual, usuario.passwordHash);
  if (!esValida) {
    throw { status: 400, body: { error: "validation", message: "la contraseña actual no es correcta" } };
  }

  const passwordHash = await hashPassword(nueva);
  await prisma.usuario.update({
    where: { id: actor.id },
    data: { passwordHash },
  });

  return { success: true };
}
