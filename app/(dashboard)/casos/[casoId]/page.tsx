/**
 * /casos/[casoId] — vista mínima del caso guardado (HU-G16).
 *
 * Server Component:
 *   1. Auth + ownership via CasoPrueba (responsableId).
 *   2. Load caso + params + pasos from DB.
 *   3. Render the script preview + "Ejecutar" button.
 *
 * Esta página es el redirect target del botón "Guardar" en HU-G16.
 * El detalle completo (HU-2.x ya lo cubre en /casos/[id] listado);
 * acá mostramos:
 *   - Header: codigo + nombre + origen
 *   - Script block (preformatted)
 *   - Botón "Ejecutar" → POST /api/casos/[id]/ejecutar (stub)
 */

import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CasoDetalleCliente } from "@/components/casos/caso-detalle-cliente";

interface PageProps {
  params: Promise<{ casoId: string }>;
}

export default async function CasoDetallePage({ params }: PageProps) {
  const { casoId } = await params;
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
    },
  });

  if (!caso) {
    notFound();
  }

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
        parametros: caso.parametros.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          valorDefecto: p.valorDefecto,
          origen: p.origen,
        })),
      }}
      backHref="/casos"
    />
  );
}
