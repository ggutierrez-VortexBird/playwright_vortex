import type { Metadata } from "next";
/** Revisión del caso grabado: carga el specCode de la sesión. */

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { RevisarCliente } from "@/components/grabador/revisar-cliente";
import { PageHeader } from "@/components/ui/page-header";


export const metadata: Metadata = { title: "Revisar grabación" };
interface PageProps {
  params: Promise<{ sesionId: string }>;
  /** Motivo por el que terminó la grabación; lo agrega el grabador al redirigir. */
  searchParams?: Promise<{ motivo?: string }>;
}

const MOTIVO_TEXTO: Record<string, string> = {
  browser_closed:
    "La grabación terminó porque se cerró la ventana del navegador. Estos son los pasos que quedaron registrados.",
  heartbeat_timeout:
    "La grabación se detuvo por inactividad. Estos son los pasos que quedaron registrados.",
};

export default async function RevisarSesionPage({
  params,
  searchParams,
}: PageProps) {
  const { sesionId } = await params;
  const motivo = (await searchParams)?.motivo;
  const avisoMotivo = motivo ? (MOTIVO_TEXTO[motivo] ?? null) : null;
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const sesion = await prisma.sesionGrabacion.findUnique({
    where: { id: sesionId },
    select: {
      id: true,
      usuarioId: true,
      nombre: true,
      urlInicial: true,
      ambiente: true,
      navegador: true,
      specCode: true,
      codegenFilePath: true,
      casoPruebaId: true,
      casoPrueba: { select: { scriptFileName: true } },
    },
  });

  if (!sesion) notFound();
  if (sesion.usuarioId !== session.userId) redirect("/casos");

  const suggestedFileName = `${sesion.nombre
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || sesion.id.slice(0, 8)}.spec.ts`;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Revisar grabación"
        breadcrumbs={[{ label: "Grabador", href: "/casos/grabar" }, { label: "Revisar" }]}
      />
      {avisoMotivo && (
        <div
          role="status"
          data-testid="aviso-motivo-fin"
          className="rounded-lg border border-m3-outline-variant bg-m3-surface-container px-4 py-3 font-body text-body-md text-m3-on-surface-variant"
        >
          {avisoMotivo}
        </div>
      )}
      <RevisarCliente
        sesionId={sesion.id}
        nombre={sesion.nombre}
        specCode={sesion.specCode ?? null}
        casoPruebaId={sesion.casoPruebaId ?? null}
        suggestedFileName={
          sesion.casoPrueba?.scriptFileName ?? suggestedFileName
        }
        urlInicial={sesion.urlInicial}
        ambiente={sesion.ambiente}
        navegador={sesion.navegador}
        codegenFilePath={sesion.codegenFilePath ?? null}
      />
    </div>
  );
}
