import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { SesionesRecuperablesClient } from "@/components/grabador/sesiones-recuperables-client";

/**
 * HU-GR-1 / HU-GR-2 — Página /casos/grabar
 *
 * Lista las sesiones de grabación del usuario actual en estados
 * recuperables (activa, pausada, detenida), ordenadas por último update.
 * Desde acá el usuario puede reanudar una sesión detenida (HU-GR-2)
 * o descartar una que ya no le sirve.
 *
 * Las sesiones 'descartada' / 'guardada' / 'error' se siguen mostrando
 * con un mensaje contextual, pero sin botón "Reanudar".
 *
 * El recorder-worker (en memoria) puede o no tener el BrowserContext
 * de la sesión; si el worker se reinició, "Reanudar" abre una sesión
 * nueva desde URL inicial — el usuario deberá rehacer la navegación. Lo
 * documentamos en la UI (badge "Sin contexto vivo").
 */

interface PageProps {
  searchParams: Promise<{ proyectoId?: string }>;
}

const ESTADOS_REANUDABLES = new Set(["detenida", "pausada"]);

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
      _count: { select: { pasos: true } },
    },
  });

  // Marcar cuáles son reanudables y cuáles no.
  const sesionesView = sesiones.map((s) => ({
    ...s,
    reanudable: ESTADOS_REANUDABLES.has(s.estado),
    startedAt: s.startedAt ? s.startedAt.toISOString() : null,
    endedAt: s.endedAt ? s.endedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Grabaciones</h2>
        <span className="sub">
          {sesionesView.length} sesión{sesionesView.length !== 1 ? "es" : ""} · recuperables y activas
        </span>
        <span className="spacer" />
        <Link href="/casos/grabar/nueva" className="btn btn-primary" data-testid="link-nueva-grabacion">
          <span className="material-symbols-outlined text-[16px]">add</span>
          Nueva grabación
        </Link>
      </div>

      <SesionesRecuperablesClient sesiones={sesionesView} />

      {sesionesView.length === 0 && (
        <div className="rounded-lg border border-rule bg-surface p-8 text-center">
          <p className="text-ink-3">No hay sesiones de grabación previas.</p>
          <Link
            href="/casos/grabar/nueva"
            className="mt-2 inline-block text-sm text-client hover:underline"
          >
            Iniciar una grabación
          </Link>
        </div>
      )}
    </div>
  );
}