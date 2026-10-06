import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SesionesRecuperablesClient } from "@/components/grabador/sesiones-recuperables-client";
import { parseSpecToSteps } from "@/lib/recorder/parse-spec";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * HU-GR-1 — Página /casos/grabar
 *
 * Lista las sesiones de grabación del usuario actual en estados
 * recuperables (activa, pausada, detenida, guardada, error), ordenadas
 * por último update. Desde acá el usuario puede revisar los pasos
 * capturados o descartar una sesión que ya no le sirve.
 *
 * "Reanudar" (HU-GR-2) existió acá pero se retiró: asumía que el
 * BrowserContext del recorder-worker seguía vivo tras detener, esperando
 * una reconexión. El grabador sin ventana de Inspector (codegen-runner)
 * cierra siempre el proceso al detener — no queda nada a lo que
 * reconectarse. "Revisar pasos capturados" es la vía real de
 * recuperación: lee el specCode ya persistido en DB.
 */

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
    // El grabador actual no escribe PasoGrabado — contar pasos reales
    // parseando el specCode, igual que hace el panel de "Revisar".
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
            <span className="material-symbols-outlined text-[16px]">add</span>
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
              <span className="material-symbols-outlined text-[16px]">add</span>
              Iniciar nueva grabación
            </Link>
          }
        />
      )}
    </div>
  );
}