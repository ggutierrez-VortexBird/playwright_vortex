import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession, getUsuarioActual, requireProyectoAccess, FORBIDDEN_ERROR, NOT_FOUND_ERROR } from "@/lib/auth";
import { getProyectoById } from "@/lib/proyectos/actions";
import { listCasos } from "@/lib/casos/actions";
import { CasosClient } from "@/app/(dashboard)/casos/casos-client";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import type { CasoPruebaListItem } from "@/types/caso";

interface PageProps {
  params: Promise<{ id: string }>;
}

function CasosSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <TableSkeleton rows={3} columns={6} />
      </div>
    </div>
  );
}

export default async function ProyectoCasosPage({ params }: PageProps) {
  const { id: proyectoId } = await params;

  const session = await getSession();

  try {
    await requireProyectoAccess(session, proyectoId);
  } catch (err) {
    if (err === NOT_FOUND_ERROR) notFound();
    if (err === FORBIDDEN_ERROR) redirect("/proyectos");
    throw err;
  }

  const [proyecto, usuario] = await Promise.all([
    getProyectoById(proyectoId),
    getUsuarioActual(session),
  ]);

  // El guard de arriba ya confirmó que el usuario tiene acceso a este
  // proyecto (superadmin, admin del espacio o tester asignado) — cualquiera
  // de los tres puede crear/editar casos y grabar.
  const canEdit = Boolean(usuario);

  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<CasosSkeleton />}>
        <ProyectoCasosGrid
          proyectoId={proyectoId}
          proyectoNombre={proyecto.nombre}
          proyectoAmbiente={proyecto.ambiente}
          canEdit={canEdit}
        />
      </Suspense>
    </div>
  );
}

async function ProyectoCasosGrid({
  proyectoId,
  proyectoNombre,
  proyectoAmbiente,
  canEdit,
}: {
  proyectoId: string;
  proyectoNombre: string;
  proyectoAmbiente: string;
  canEdit: boolean;
}) {
  const casos = await listCasos(proyectoId);

  return (
    <CasosClient
      casosIniciales={casos}
      canEdit={canEdit}
      proyectoId={proyectoId}
      proyectoContext={{ nombre: proyectoNombre, ambiente: proyectoAmbiente }}
    />
  );
}
