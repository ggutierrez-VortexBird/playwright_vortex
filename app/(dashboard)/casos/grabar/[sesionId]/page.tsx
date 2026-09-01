import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { GrabadorClient } from "@/components/grabador/grabador-client";
import type { GrabadorTopbarMeta } from "@/components/grabador/grabador-topbar";
import type { PasoEnVivo } from "@/components/grabador/use-pasos-en-vivo";

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
      nombre: true,
      ambiente: true,
      navegador: true,
      credencialId: true,
      startedAt: true,
      createdAt: true,
      credencial: {
        select: { nombre: true },
      },
      // HU-G3: server-load pasos for the initial render. Live updates
      // arrive via `paso_agregado` WS messages dispatched as window events.
      pasos: {
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          tipo: true,
          descripcion: true,
          valor: true,
          esValorSensible: true,
          createdAt: true,
        },
      },
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

  const topbarMeta: GrabadorTopbarMeta = {
    nombre: sesion.nombre,
    sesionShortId: `SES-${sesion.id.slice(0, 4).toUpperCase()}`,
    ambiente: sesion.ambiente,
    navegador: sesion.navegador,
    credencialNombre: sesion.credencial?.nombre ?? "",
  };

  // HU-G2: cronómetro anchored to sesion.startedAt (fallback createdAt).
  // Started at the first WebSocket connect; createdAt is the DB creation
  // timestamp if the browser hasn't connected yet.
  const startedAtIso = (
    sesion.startedAt ?? sesion.createdAt
  ).toISOString();

  // HU-G3: hydrate the panel with the pasos persisted so far. The WS
  // stream will keep appending new ones.
  const initialPasos: PasoEnVivo[] = sesion.pasos.map((p) => ({
    id: p.id,
    numero: p.numero,
    tipo: p.tipo,
    descripcion: p.descripcion,
    valor: p.valor,
    esValorSensible: p.esValorSensible,
    parametroNombre: null, // HU-G7 wires this
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <GrabadorClient
      wsUrl={finalWsUrl}
      urlInicial={sesion.urlInicial}
      topbarMeta={topbarMeta}
      sesionId={sesion.id}
      startedAt={startedAtIso}
      initialPasos={initialPasos}
    />
  );
}
