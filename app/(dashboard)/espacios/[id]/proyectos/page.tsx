import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listProyectosByEspacio, getMetrics } from "@/lib/proyectos/actions";
import { getEspacioById } from "@/lib/espacios/actions";
import { ProyectoGrid } from "./proyecto-grid";
import { ScopeBar } from "@/components/ui/scope-bar";
import type { ProyectoWithMetrics } from "@/types/proyecto";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProyectosWithMetrics(espacioId: string): Promise<ProyectoWithMetrics[]> {
  const proyectos = await listProyectosByEspacio(espacioId);

  const proyectosWithMetrics = await Promise.all(
    proyectos.map(async (proyecto) => {
      const metrics = await getMetrics(proyecto.id);
      return {
        ...proyecto,
        totalCasos: metrics.totalCasos,
        casosConformes: metrics.casosConformes,
        casosNoConformes: metrics.casosNoConformes,
        fechaUltimaEjecucion: metrics.fechaUltimaEjecucion,
      } as ProyectoWithMetrics;
    })
  );

  return proyectosWithMetrics;
}

function ProyectoSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-4"
        >
          <div className="h-4 w-20 rounded bg-m3-surface-container-high" />
          <div className="mt-2 h-6 w-32 rounded bg-m3-surface-container-high" />
          <div className="mt-1 h-4 w-16 rounded bg-m3-surface-container-high" />
          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-m3-outline-variant pt-4">
            <div className="h-8 rounded bg-m3-surface-container-high" />
            <div className="h-8 rounded bg-m3-surface-container-high" />
            <div className="h-8 rounded bg-m3-surface-container-high" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ProyectosPage({ params }: PageProps) {
  const { id: espacioId } = await params;

  const [espacio, session] = await Promise.all([
    getEspacioById(espacioId),
    getSession(),
  ]);

  if (!espacio) {
    return (
      <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center">
        <p className="text-m3-on-surface-variant">Espacio no encontrado.</p>
      </div>
    );
  }

  const isSuperadmin = session?.userId
    ? await prisma.usuario.findUnique({
        where: { id: session.userId },
        select: { rol: true },
      })
    : null;

  const canCreate = isSuperadmin?.rol === "superadmin";

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <ScopeBar espacioNombre={espacio.nombre} espacioColor={espacio.color} />
        <p className="mt-1 text-m3-on-surface-variant">Proyectos del espacio</p>
      </div>

      {/* Proyectos Grid with Suspense */}
      <Suspense fallback={<ProyectoSkeleton />}>
        <ProyectoGrid
          espacioId={espacioId}
          espacioNombre={espacio.nombre}
          espacioColor={espacio.color}
          canEdit={canCreate}
        />
      </Suspense>
    </div>
  );
}
