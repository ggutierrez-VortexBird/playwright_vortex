import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, getUsuarioActual, scopeEspacioWhere } from "@/lib/auth";
import { getEspaciosMetrics } from "@/lib/espacios/actions";
import { EspaciosClient } from "./espacios-client";
import type { EspacioConMetrics } from "@/types/espacio";

interface EspaciosPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function EspaciosPage({ searchParams }: EspaciosPageProps) {
  const { q } = await searchParams;
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  // Un tester no tiene alcance a nivel Espacio en absoluto.
  if (usuario?.rol === "tester") {
    redirect("/proyectos");
  }

  const todosLosEspacios = await prisma.espacio.findMany({
    where: {
      activo: true,
      ...(usuario ? scopeEspacioWhere(usuario) : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const query = q?.trim().toLowerCase();
  const espacios = query
    ? todosLosEspacios.filter((e) => e.nombre.toLowerCase().includes(query))
    : todosLosEspacios;

  const metricsPorEspacio = await getEspaciosMetrics(espacios.map((e) => e.id));

  const espaciosConMetrics: EspacioConMetrics[] = espacios.map((e) => ({
    ...e,
    ...metricsPorEspacio[e.id],
  }));

  const canEdit = usuario?.rol === "superadmin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-headline text-headline-lg text-m3-primary">Espacios</h2>
        <p className="mt-1 font-body text-body-md text-m3-on-surface-variant">
          {canEdit
            ? "Organiza tu trabajo por cliente o área. Cada espacio tiene un color propio que se propaga a sus proyectos, casos y ejecuciones."
            : "Espacios que administrás. Solo el superadmin puede crear, editar o eliminar un espacio."}
        </p>
      </div>
      <div className="mt-2">
        <EspaciosClient initialEspacios={espaciosConMetrics} canEdit={canEdit} />
      </div>
    </div>
  );
}
