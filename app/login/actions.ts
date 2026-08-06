"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { saveSession } from "@/lib/auth";

export async function iniciarSesion(
  _prevState: Record<string, unknown>,
  formData: FormData
): Promise<{ error?: string }> {
  const email = (formData.get("email") as string)?.trim() || "";
  const password = (formData.get("password") as string) || "";

  const usuario = await prisma.usuario.findUnique({
    where: { email },
  });

  if (!usuario) {
    return { error: "Credenciales inválidas" };
  }

  const isValid = await verifyPassword(password, usuario.passwordHash);

  if (!isValid) {
    return { error: "Credenciales inválidas" };
  }

  const from = (formData.get("from") as string) || "/";

  await saveSession(usuario.id, usuario.email);
  redirect(from);
}
