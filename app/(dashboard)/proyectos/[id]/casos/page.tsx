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
          <div className="h-8 w-48 animate-pulse rounded bg-rule-soft" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-rule-soft" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded bg-rule-soft" />
      </div>
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-rule-soft" />
        <div className="overflow-hidden rounded-lg border border-rule bg-surface">
          <div className="h-10 animate-pulse bg-rule-soft" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse bg-rule-soft/50" />
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
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>{proyecto.nombre}</h2>
        <span className="sub">{proyecto.ambiente} · Casos de prueba</span>
        <span className="spacer" />
        {canEdit && (
          <Link
            href={`/casos/grabar/nueva?proyectoId=${proyectoId}`}
            className="btn"
            style={{
              background: "var(--stamp)",
              borderColor: "var(--stamp)",
              color: "#fff",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#fff",
                display: "inline-block",
                animation: "stampPulse 1.6s ease-in-out infinite",
              }}
            />
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
