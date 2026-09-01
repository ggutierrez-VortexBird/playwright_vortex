import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { GrabadorClient } from "@/components/grabador/grabador-client";

interface PageProps {
  params: Promise<{ sesionId: string }>;
  searchParams: Promise<{ token?: string; wsUrl?: string }>;
}

export default async function SesionGrabacionPage({ params, searchParams }: PageProps) {
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
    },
  });

  if (!sesion) {
    notFound();
  }

  if (sesion.usuarioId !== session.userId) {
    redirect("/casos");
  }

  // El token y wsUrl se pasan por searchParams cuando el cliente llega
  // desde /nueva. Si no están (refresh directo o link externo), los derivamos.
  const finalToken = token ?? sesion.token;
  if (!finalToken) {
    return (
      <div className="flex flex-col gap-6">
        <div className="topbar -mx-6 -mt-6 rounded-none">
          <h2>Grabación</h2>
        </div>
        <div className="card p-6 text-center text-ink-3">
          Esta sesión no tiene un token activo. Vuelve a iniciar la grabación.
        </div>
      </div>
    );
  }

  const finalWsUrl =
    wsUrl ?? `${process.env.RECORDER_PUBLIC_URL ?? "ws://localhost:3100"}/?token=${encodeURIComponent(finalToken)}`;

  return (
    <GrabadorClient
      sessionId={sesion.id}
      initialToken={finalToken}
      wsUrl={finalWsUrl}
      urlInicial={sesion.urlInicial}
    />
  );
}