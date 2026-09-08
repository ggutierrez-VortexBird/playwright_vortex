import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getProyectoById } from "@/lib/proyectos/actions";
import { listCasos } from "@/lib/casos/actions";
import { CasosClient } from "@/app/(dashboard)/casos/casos-client";
import type { CasoPruebaListItem } from "@/types/caso";

interface PageProps {
  params: Promise<{ id: string }>;
}

function CasosSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-m3-surface-container-high" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-m3-surface-container-high" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded bg-m3-surface-container-high" />
      </div>
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-m3-surface-container-high" />
        <div className="overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest">
          <div className="h-10 animate-pulse bg-m3-surface-container-high" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse bg-m3-surface-container-high/50" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function ProyectoCasosPage({ params }: PageProps) {
  const { id: proyectoId } = await params;

  const [proyecto, session] = await Promise.all([
    getProyectoById(proyectoId),
    getSession(),
  ]);

  const isSuperadmin = session?.userId
    ? await prisma.usuario.findUnique({
        where: { id: session.userId },
        select: { rol: true },
      })
    : null;

  const canEdit = isSuperadmin?.rol === "superadmin";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">{proyecto.nombre}</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">{proyecto.ambiente} · Casos de prueba</span>
        <span className="ml-auto" />
        {canEdit && (
          <Link
            href={`/casos/grabar/nueva?proyectoId=${proyectoId}`}
            className="flex items-center gap-2 rounded bg-m3-secondary-container px-4 py-2 font-label text-label-md font-semibold text-m3-on-secondary-container transition-colors hover:bg-m3-secondary-fixed"
          >
            <span className="material-symbols-outlined text-[18px]">videocam</span>
            Grabar caso
          </Link>
        )}
      </div>

      {/* Casos with Suspense */}
      <Suspense fallback={<CasosSkeleton />}>
        <ProyectoCasosGrid
          proyectoId={proyectoId}
          canEdit={canEdit}
        />
      </Suspense>
    </div>
  );
}

async function ProyectoCasosGrid({
  proyectoId,
  canEdit,
}: {
  proyectoId: string;
  canEdit: boolean;
}) {
  const casos = await listCasos(proyectoId);

  return (
    <CasosClient
      casosIniciales={casos}
      canEdit={canEdit}
      proyectoId={proyectoId}
    />
  );
}
