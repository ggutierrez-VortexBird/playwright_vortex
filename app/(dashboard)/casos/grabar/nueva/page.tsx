import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NuevaGrabacionForm } from "@/components/grabador/nueva-grabacion-form";
import type { CredencialListItem } from "@/lib/grabador/types";

interface PageProps {
  searchParams: Promise<{ proyectoId?: string }>;
}

export default async function NuevaGrabacionPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const { proyectoId } = await searchParams;

  // Si hay proyectoId en query, cargar ese proyecto + sus credenciales.
  // Si no, mostrar el primer proyecto del usuario como default.
  let resolvedProyectoId = proyectoId;
  if (!resolvedProyectoId) {
    const firstProyecto = await prisma.proyecto.findFirst({
      where: { activo: true },
      orderBy: { createdAt: "asc" },
    });
    if (!firstProyecto) {
      return (
        <div className="flex flex-col gap-6">
          <div className="topbar -mx-6 -mt-6 rounded-none">
            <h2>Nueva grabación</h2>
          </div>
          <div className="card p-6 text-center text-ink-3">
            No hay proyectos activos. Crea un proyecto primero.
          </div>
        </div>
      );
    }
    resolvedProyectoId = firstProyecto.id;
  }

  const [proyecto, credencialesRaw] = await Promise.all([
    prisma.proyecto.findUnique({
      where: { id: resolvedProyectoId },
      select: { id: true, nombre: true, ambiente: true },
    }),
    prisma.credencial.findMany({
      where: { proyectoId: resolvedProyectoId },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        sesionVenceAt: true,
      },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (!proyecto) {
    return (
      <div className="flex flex-col gap-6">
        <div className="topbar -mx-6 -mt-6 rounded-none">
          <h2>Nueva grabación</h2>
        </div>
        <div className="card p-6 text-center text-ink-3">Proyecto no encontrado.</div>
      </div>
    );
  }

  const credenciales: CredencialListItem[] = credencialesRaw.map((c) => ({
    id: c.id,
    nombre: c.nombre,
    tipo: c.tipo as CredencialListItem["tipo"],
    vence: c.sesionVenceAt ? c.sesionVenceAt.toISOString() : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Nueva grabación</h2>
        <span className="sub">{proyecto.nombre} · {proyecto.ambiente}</span>
        <span className="spacer" />
      </div>
      <NuevaGrabacionForm
        proyectoId={proyecto.id}
        credenciales={credenciales}
      />
    </div>
  );
}