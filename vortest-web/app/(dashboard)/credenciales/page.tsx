import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { listarCredenciales } from "@/lib/credenciales/gestion";
import { CredencialesClient } from "./credenciales-client";

export const metadata: Metadata = { title: "Credenciales" };

export default async function CredencialesPage() {
  const session = await getSession();
  const usuario = await getUsuarioActual(session);
  if (!usuario) redirect("/api/logout");
  // Exclusivo del superadmin: los demás roles nunca ven ni usan credenciales.
  if (usuario.rol !== "superadmin") redirect("/proyectos");

  const [credenciales, proyectos] = await Promise.all([
    listarCredenciales(session),
    prisma.proyecto.findMany({
      where: { activo: true },
      orderBy: [{ espacio: { nombre: "asc" } }, { nombre: "asc" }],
      select: { id: true, nombre: true, espacio: { select: { nombre: true } } },
    }),
  ]);

  return (
    <CredencialesClient
      credenciales={credenciales}
      proyectos={proyectos.map((p) => ({ id: p.id, nombre: p.nombre, espacio: p.espacio.nombre }))}
    />
  );
}
