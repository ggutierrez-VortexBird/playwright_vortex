/**
 * /casos/grabar/[sesionId]/revisar — revisión de caso grabado (HU-G8, V2).
 *
 * Pivot playwright-codegen: cargamos `specCode` (raw .spec.ts) del
 * recorder-worker y se lo pasamos al RevisarCliente. NO se cargan
 * PasoGrabado[] ni ParametroGrabacion[] — esos modelos existen en DB
 * pero el grabador V2 ya no escribe rows nuevos.
 */

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { RevisarCliente } from "@/components/grabador/revisar-cliente";

interface PageProps {
  params: Promise<{ sesionId: string }>;
  /** `motivo` explica por qué terminó la grabación. Lo agrega el grabador
   *  al redirigir; interesa sobre todo cuando terminó sola, porque el
   *  usuario cerró la ventana del navegador. */
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
    <>
      {avisoMotivo && (
        <div
          role="status"
          data-testid="aviso-motivo-fin"
          className="mb-4 rounded-lg border border-m3-outline-variant bg-m3-surface-container px-4 py-3 font-body text-body-md text-m3-on-surface-variant"
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
    </>
  );
}
