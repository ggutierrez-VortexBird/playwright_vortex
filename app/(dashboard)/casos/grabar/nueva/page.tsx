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
          <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
            <h2 className="font-headline text-headline-lg text-m3-primary">Nueva grabación</h2>
          </div>
          <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-6 text-center text-m3-on-surface-variant">
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
        <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
          <h2 className="font-headline text-headline-lg text-m3-primary">Nueva grabación</h2>
        </div>
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-6 text-center text-m3-on-surface-variant">Proyecto no encontrado.</div>
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
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Nueva grabación</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">{proyecto.nombre} · {proyecto.ambiente}</span>
        <span className="ml-auto" />
      </div>
      <div className="w-full flex justify-center py-8">
        <NuevaGrabacionForm
          proyectoId={proyecto.id}
          credenciales={credenciales}
        />
      </div>
    </div>
  );
}