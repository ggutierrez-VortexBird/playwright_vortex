import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SesionesRecuperablesClient } from "@/components/grabador/sesiones-recuperables-client";
import { parseSpecToSteps } from "@/lib/recorder/parse-spec";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";


export const metadata: Metadata = { title: "Grabador" };
/** Lista las sesiones de grabación recuperables del usuario. */

interface PageProps {
  searchParams: Promise<{ proyectoId?: string }>;
}

export default async function SesionesRecuperablesPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const { proyectoId } = await searchParams;

  const where: import("@prisma/client").Prisma.SesionGrabacionWhereInput = {
    usuarioId: session.userId,
    estado: { in: ["activa", "pausada", "detenida", "guardada", "error"] },
  };
  if (proyectoId) {
    where.proyectoId = proyectoId;
  }

  const sesiones = await prisma.sesionGrabacion.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      nombre: true,
      urlInicial: true,
      ambiente: true,
      navegador: true,
      estado: true,
      mensajeError: true,
      startedAt: true,
      endedAt: true,
      createdAt: true,
      updatedAt: true,
      proyecto: { select: { nombre: true } },
      credencial: { select: { nombre: true } },
      specCode: true,
    },
  });

  const sesionesView = sesiones.map(({ specCode, ...s }) => ({
    ...s,
    // Cuenta los pasos parseando el specCode, como el panel de Revisar.
    pasosCount: parseSpecToSteps(specCode ?? "").length,
    startedAt: s.startedAt ? s.startedAt.toISOString() : null,
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Grabador"
        subtitle={`${sesionesView.length} ${sesionesView.length === 1 ? "sesión" : "sesiones"} recuperables`}
        badge={{ value: sesionesView.length, label: "sesiones" }}
        actions={
          <Link
            href="/casos/grabar/nueva"
            className="inline-flex items-center gap-1.5 rounded bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary hover:opacity-90 transition-opacity"
            data-testid="link-nueva-grabacion"
          >
            <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>
            Nueva grabación
          </Link>
        }
      />

      <SesionesRecuperablesClient sesiones={sesionesView} />

      {sesionesView.length === 0 && (
        <EmptyState
          icon="videocam"
          title="No hay sesiones de grabación"
          description="Las sesiones se recuperan automáticamente si cierras el navegador"
          action={
            <Link
              href="/casos/grabar/nueva"
              className="inline-flex items-center gap-2 rounded bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary hover:opacity-90 transition-opacity"
            >
              <span aria-hidden="true" className="material-symbols-outlined text-[16px]">add</span>
              Iniciar nueva grabación
            </Link>
          }
        />
      )}
    </div>
  );
}