import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, getUsuarioActual, requireProyectoAccess, scopeProyectoWhere, FORBIDDEN_ERROR } from "@/lib/auth";
import { NuevaGrabacionForm } from "@/components/grabador/nueva-grabacion-form";
import type { CredencialListItem } from "@/lib/grabador/types";
import { PageHeader } from "@/components/ui/page-header";

interface PageProps {
  searchParams: Promise<{ proyectoId?: string }>;
}

export default async function NuevaGrabacionPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const { proyectoId } = await searchParams;

  if (proyectoId) {
    try {
      await requireProyectoAccess(session, proyectoId);
    } catch (err) {
      if (err === FORBIDDEN_ERROR) redirect("/casos");
      throw err;
    }
  }

  const usuario = await getUsuarioActual(session);

  // Si hay proyectoId en query, cargar ese proyecto + sus credenciales.
  // Si no, mostrar el primer proyecto visible para el usuario como default.
  let resolvedProyectoId = proyectoId;
  if (!resolvedProyectoId) {
    const firstProyecto = await prisma.proyecto.findFirst({
      where: {
        activo: true,
        ...(usuario ? scopeProyectoWhere(usuario) : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    if (!firstProyecto) {
      return (
        <div className="flex flex-col gap-6">
          <PageHeader title="Nueva grabación" breadcrumbs={[{ label: "Grabador", href: "/casos/grabar" }, { label: "Nueva" }]} />
          <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center text-m3-on-surface-variant">
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
        <PageHeader title="Nueva grabación" breadcrumbs={[{ label: "Grabador", href: "/casos/grabar" }, { label: "Nueva" }]} />
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center text-m3-on-surface-variant">Proyecto no encontrado.</div>
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
      <PageHeader
        title="Nueva grabación"
        breadcrumbs={[{ label: "Grabador", href: "/casos/grabar" }, { label: "Nueva" }]}
        subtitle={`${proyecto.nombre} · ${proyecto.ambiente}`}
      />
      <div className="w-full flex justify-center py-8">
        <NuevaGrabacionForm
          proyectoId={proyecto.id}
          credenciales={credenciales}
        />
      </div>
    </div>
  );
}