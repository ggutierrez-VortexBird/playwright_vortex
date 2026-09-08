/**
 * Server Component — SesionGrabacionPage (V2 — Pivot playwright-codegen).
 *
 * Carga la sesion (con su specCode persistido, si lo hay) y monta el
 * GrabadorClient con el WS URL derivado del token de la sesión.
 *
 * V2 simplification: ya no server-loads PasoGrabado[] — el /grabar solo
 * muestra el spec en vivo (single source of truth: specCode).
 */
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { GrabadorClient } from "@/components/grabador/grabador-client";

interface PageProps {
  params: Promise<{ sesionId: string }>;
  searchParams: Promise<{ token?: string; wsUrl?: string }>;
}

export default async function SesionGrabacionPage({
  params,
  searchParams,
}: PageProps) {
  const { sesionId } = await params;
  const { token, wsUrl } = await searchParams;
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id: sesionId },
    select: {
      id: true,
      usuarioId: true,
      estado: true,
      urlInicial: true,
      token: true,
      mensajeError: true,
      nombre: true,
      startedAt: true,
      createdAt: true,
    },
  });

  if (!sesion) {
    notFound();
  }
  if (sesion.usuarioId !== session.userId) {
    redirect("/casos");
  }

  const finalToken = token ?? sesion.token;
  if (!finalToken) {
    return (
      <div className="flex flex-col gap-6">
        <div className="-mx-6 -mt-6 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
          <h2 className="font-headline text-headline-lg text-m3-primary">Grabación</h2>
        </div>
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest p-6 text-center font-body text-body-md text-m3-on-surface-variant shadow-sm">
          Esta sesión no tiene un token activo. Vuelve a iniciar la grabación.
        </div>
      </div>
    );
  }

  const finalWsUrl =
    wsUrl ??
    `${process.env.RECORDER_PUBLIC_URL ?? "ws://localhost:3100"}/?token=${encodeURIComponent(finalToken)}`;

  const startedAtIso = (
    sesion.startedAt ?? sesion.createdAt
  ).toISOString();

  return (
    <GrabadorClient
      wsUrl={finalWsUrl}
      urlInicial={sesion.urlInicial}
      sesionId={sesion.id}
      startedAt={startedAtIso}
      titulo={sesion.nombre}
    />
  );
}
