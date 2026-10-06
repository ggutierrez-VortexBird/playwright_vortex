"use server";

import { redirect } from "next/navigation";
import { headers as nextHeaders } from "next/headers";
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

function claveRateLimit(email: string, ip: string): string {
  return createHash("sha256").update(`${ip}:${email.toLowerCase()}`).digest("hex");
}

export async function iniciarSesion(
  _prevState: Record<string, unknown>,
  formData: FormData
): Promise<{ error?: string; field?: "email" | "password" }> {
  const email = (formData.get("email") as string)?.trim() || "";
  const password = (formData.get("password") as string) || "";

  // SEG-05: rate limit por IP + email
  let ip = "unknown";
  try {
    const hdrs = await nextHeaders();
    ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? hdrs.get("x-real-ip") ?? "unknown";
  } catch {
    // headers() no está disponible (tests, edge runtime sin request) — se degrada
    // a "unknown" lo que pone un techo a la efectividad del rate limit pero no lo
    // rompe: la IP real solo importa para aislar ataques desde múltiples IPs.
  }
  const clave = claveRateLimit(email, ip);
  const cutoff = new Date(Date.now() - VENTANA_MIN * 60 * 1000);

  const intento = await prisma.intentoLogin.findUnique({ where: { clave } });
  if (intento && intento.ventanaAt >= cutoff && intento.intentos >= MAX_INTENTOS) {
    return { error: "Demasiados intentos. Esperá unos minutos antes de reintentar." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
  });

  // SEG-06: mensaje único, sin distinguir "no existe" vs "contraseña mal"
  const ok = await verifyPassword(password, usuario?.passwordHash ?? DUMMY_HASH);
  if (!usuario || !ok) {
    // SEG-05: registrar intento fallido
    if (intento && intento.ventanaAt >= cutoff) {
      await prisma.intentoLogin.update({
        where: { clave },
        data: { intentos: { increment: 1 }, ventanaAt: new Date() },
      });
    } else {
      await prisma.intentoLogin.upsert({
        where: { clave },
        create: { clave, intentos: 1, ventanaAt: new Date() },
        update: { intentos: 1, ventanaAt: new Date() },
      });
    }
    return { error: "Credenciales inválidas" };
  }

  // Login exitoso: limpiar contador
  if (intento) {
    await prisma.intentoLogin.delete({ where: { clave } }).catch(() => {});
  }

  if (!usuario.activo) {
    return { error: "Esta cuenta está suspendida. Contacta a un administrador." };
  }

  // SEG-07: open redirect — solo rutas relativas internas
  let from = (formData.get("from") as string) || "/";
  if (!from.startsWith("/") || from.startsWith("//") || from.includes("://")) {
    from = "/";
  }

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAccesoAt: new Date() },
  });
  await saveSession(usuario.id, usuario.email);
  redirect(from);
}
