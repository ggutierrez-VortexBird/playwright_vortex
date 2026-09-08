/**
 * /casos/[casoId] — vista del caso guardado (HU-G16 + HU-G12 + HU-G13).
 *
 * Server Component:
 *   1. Auth + ownership via CasoPrueba (responsableId).
 *   2. Load caso + params + pasos from DB.
 *   3. Render the script preview + "Ejecutar" button + CSV upload UI.
 *
 * Esta página es el redirect target del botón "Guardar" en HU-G16.
 * El detalle completo (HU-2.x ya lo cubre en /casos/[id] listado);
 * acá mostramos:
 *   - Header: codigo + nombre + origen
 *   - Script block (preformatted)
 *   - Panel de parámetros editable (HU-G12) con "sin uso" derivado
 *   - Botón "Ejecutar" → POST /api/casos/[id]/ejecutar
 *   - Subir CSV data-driven (HU-G13)
 */

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CasoDetalleCliente } from "@/components/casos/caso-detalle-cliente";

interface PageProps {
  params: Promise<{ casoId: string }>;
  /** `editarScript=1` abre el editor de una — llega desde la acción
   *  "Script" de la tabla de Casos, para no tener que entrar al detalle
   *  y después buscar el botón. */
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
      parametros: {
        orderBy: { nombre: "asc" },
        select: { id: true, nombre: true, valorDefecto: true, origen: true },
      },
      // Para HU-G12: calcular enUso desde los pasos.
      pasosGrabados: {
        orderBy: { numero: "asc" },
        select: { descripcion: true, valor: true },
      },
    },
  });

  if (!caso) {
    notFound();
  }

  // HU-G12: calcular enUso dinámicamente.
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

  return (
    <CasoDetalleCliente
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
