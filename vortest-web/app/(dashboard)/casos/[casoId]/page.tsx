import { migasDeProyecto } from "@/lib/migas";
import { tituloConAcceso } from "@/lib/metadata";
import type { Metadata } from "next";
/** Vista del caso guardado: script, parámetros y subida de CSV. */

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, requireProyectoAccess, FORBIDDEN_ERROR } from "@/lib/auth";
import { CasoDetalleCliente } from "@/components/casos/caso-detalle-cliente";


export async function generateMetadata({ params }: { params: Promise<{ casoId: string }> }): Promise<Metadata> {
  const { casoId } = await params;
  const caso = await prisma.casoPrueba.findUnique({ where: { id: casoId }, select: { nombre: true, proyectoId: true } });
  return { title: await tituloConAcceso(caso?.proyectoId, caso?.nombre, "Caso de prueba") };
}
interface PageProps {
  params: Promise<{ casoId: string }>;
  /** Con `editarScript=1` abre el editor directamente. */
  searchParams?: Promise<{ editarScript?: string }>;
}

export default async function CasoDetallePage({ params, searchParams }: PageProps) {
  const { casoId } = await params;
  const editarScript = (await searchParams)?.editarScript === "1";
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const caso = await prisma.casoPrueba.findUnique({
    where: { id: casoId },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      script: true,
      scriptFileName: true,
      origen: true,
      activo: true,
      createdAt: true,
      updatedAt: true,
      proyectoId: true,
      responsableId: true,
      proyecto: { select: { id: true, nombre: true, espacio: { select: { id: true, nombre: true } } } },
      parametros: {
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, valorDefecto: true, origen: true },
      },
      pasosGrabados: {
        orderBy: { numero: "asc" },
        select: { descripcion: true, valor: true },
      },
    },
  });

  if (!caso) {
    notFound();
  }

  try {
    await requireProyectoAccess(session, caso.proyectoId);
  } catch (err) {
    if (err === FORBIDDEN_ERROR) redirect("/casos");
    throw err;
  }

  // Calcula enUso a partir de los pasos.
  const parametrosConEnUso = caso.parametros.map((p) => {
    const token = `{{${p.nombre}}}`;
    const enUso = caso.pasosGrabados.some(
      (paso) =>
        (paso.descripcion != null && paso.descripcion.includes(token)) ||
        (paso.valor != null && paso.valor.includes(token)),
    );
    return {
      id: p.id,
      nombre: p.nombre,
      valorDefecto: p.valorDefecto,
      origen: p.origen,
      enUso,
    };
  });

  const migas = [...(await migasDeProyecto(session, caso.proyecto)), { label: caso.nombre }];

  return (
    <CasoDetalleCliente
      migas={migas}
      caso={{
        id: caso.id,
        codigo: caso.codigo,
        nombre: caso.nombre,
        script: caso.script,
        scriptFileName: caso.scriptFileName,
        origen: caso.origen,
        activo: caso.activo,
        createdAt: caso.createdAt.toISOString(),
        updatedAt: caso.updatedAt.toISOString(),
        parametros: parametrosConEnUso,
      }}
      backHref="/casos"
      autoAbrirEditorScript={editarScript}
    />
  );
}
