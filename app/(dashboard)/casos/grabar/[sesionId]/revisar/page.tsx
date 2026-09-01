/**
 * /casos/grabar/[sesionId]/revisar — pantalla de revisión completa (HU-G8).
 *
 * Server Component:
 *   1. Auth + ownership check.
 *   2. Load sesion + pasos + parametros from DB.
 *   3. Render `<RevisarCliente>` con esos datos.
 *
 * La pantalla completa (drag-and-drop, agregar paso, guardar, etc.) es
 * HU-G8 + HU-G10 + HU-G16; acá solo cableamos el server-side.
 */

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  RevisarCliente,
  type RevisarPasoItem,
  type RevisarParametroItem,
} from "@/components/grabador/revisar-cliente";

interface PageProps {
  params: Promise<{ sesionId: string }>;
}

export default async function RevisarSesionPage({ params }: PageProps) {
  const { sesionId } = await params;
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
      pasos: {
        orderBy: { numero: "asc" },
        select: {
          id: true,
          numero: true,
          tipo: true,
          descripcion: true,
          selectorPrincipal: true,
          selectoresRespaldo: true,
          valor: true,
          esValorSensible: true,
          assertionKind: true,
        },
      },
      parametros: {
        orderBy: { nombre: "asc" },
        select: {
          id: true,
          nombre: true,
          valorDefecto: true,
          origen: true,
          enUso: true,
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

  const pasosIniciales: RevisarPasoItem[] = sesion.pasos.map((p) => ({
    id: p.id,
    numero: p.numero,
    tipo: p.tipo,
    descripcion: p.descripcion,
    selectorPrincipal: p.selectorPrincipal,
    selectoresRespaldo: p.selectoresRespaldo,
    valor: p.valor,
    esValorSensible: p.esValorSensible,
    assertionKind: p.assertionKind,
  }));

  const parametrosIniciales: RevisarParametroItem[] = sesion.parametros.map(
    (p) => ({
      id: p.id,
      nombre: p.nombre,
      valorDefecto: p.valorDefecto,
      origen: p.origen,
      enUso: p.enUso,
    }),
  );

  return (
    <RevisarCliente
      sesionId={sesion.id}
      nombre={sesion.nombre}
      pasosIniciales={pasosIniciales}
      parametrosIniciales={parametrosIniciales}
    />
  );
}
