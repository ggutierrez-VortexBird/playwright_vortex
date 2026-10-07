"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { saveSession } from "@/lib/auth";

// SEG-06: hash dummy precalculado — iguala el tiempo de respuesta cuando el
// usuario no existe, evitando el canal lateral de enumeración.
const DUMMY_HASH = bcrypt.hashSync("noop", 10);

// SEG-05: rate limiting
const VENTANA_MIN = 15; // minutos
const MAX_INTENTOS = 5;

function claveRateLimit(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex");
}

// upsert nativo + increment en SQL: dos intentos simultáneos suman los dos, ya no se pisan con un read-modify-write.
async function registrarIntentoFallido(clave: string, ventanaVencida: boolean): Promise<void> {
  const ahora = new Date();
  await prisma.intentoLogin.upsert({
    where: { clave },
    create: { clave, intentos: 1, ventanaAt: ahora },
    update: ventanaVencida ? { intentos: 1, ventanaAt: ahora } : { intentos: { increment: 1 }, ventanaAt: ahora },
  });
}

function esRutaInterna(ruta: string): boolean {
  if (!ruta.startsWith("/") || ruta.startsWith("//") || ruta.includes("\\")) return false;
  try {
    return new URL(ruta, "http://vortest.local").origin === "http://vortest.local";
  } catch {
    return false;
  }
}

export async function iniciarSesion(
  _prevState: Record<string, unknown>,
  formData: FormData
): Promise<{ error?: string; field?: "email" | "password" }> {
  const email = (formData.get("email") as string)?.trim() || "";
  const password = (formData.get("password") as string) || "";

  // Clave sólo por email: la IP salía de x-forwarded-for, que manda el cliente, y cambiándola se evadía el límite.
  const clave = claveRateLimit(email);
  const cutoff = new Date(Date.now() - VENTANA_MIN * 60 * 1000);

  const intento = await prisma.intentoLogin.findUnique({ where: { clave } });
  if (intento && intento.ventanaAt >= cutoff && intento.intentos >= MAX_INTENTOS) {
    return { error: "Demasiados intentos. Espera unos minutos antes de reintentar." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
  });

  // SEG-06: mensaje único, sin distinguir "no existe" vs "contraseña mal"
  const ok = await verifyPassword(password, usuario?.passwordHash ?? DUMMY_HASH);
  if (!usuario || !ok) {
    await registrarIntentoFallido(clave, !intento || intento.ventanaAt < cutoff);
    return { error: "Credenciales inválidas" };
  }

  // Login exitoso: limpiar contador
  if (intento) {
    await prisma.intentoLogin.delete({ where: { clave } }).catch(() => {});
  }

  if (!usuario.activo) {
    return { error: "Esta cuenta está suspendida. Contacta a un administrador." };
  }

  // SEG-07: sólo rutas internas; `/evil.com` pasaba la validación anterior y los navegadores lo tratan como `//evil.com`.
  const destino = (formData.get("from") as string) || "/";
  const from = esRutaInterna(destino) ? destino : "/";

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAccesoAt: new Date() },
  });
  await saveSession(usuario.id, usuario.email);
  redirect(from);
}
