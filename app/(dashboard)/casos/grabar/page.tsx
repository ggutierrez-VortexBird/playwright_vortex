import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SesionesRecuperablesClient } from "@/components/grabador/sesiones-recuperables-client";
import { parseSpecToSteps } from "@/lib/recorder/parse-spec";

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
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Grabaciones</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">
          {sesionesView.length} sesión{sesionesView.length !== 1 ? "es" : ""} · recuperables y activas
        </span>
        <span className="ml-auto" />
        <Link href="/casos/grabar/nueva" className="rounded bg-m3-primary px-4 py-2 font-label text-label-md font-semibold text-m3-on-primary hover:opacity-90 transition-opacity" data-testid="link-nueva-grabacion">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Nueva grabación
        </Link>
      </div>

      <SesionesRecuperablesClient sesiones={sesionesView} />

      {sesionesView.length === 0 && (
        <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center">
          <p className="text-m3-on-surface-variant">No hay sesiones de grabación previas.</p>
          <Link
            href="/casos/grabar/nueva"
            className="mt-2 inline-block text-sm text-m3-secondary hover:underline"
          >
            Iniciar una grabación
          </Link>
        </div>
      )}
    </div>
  );
}