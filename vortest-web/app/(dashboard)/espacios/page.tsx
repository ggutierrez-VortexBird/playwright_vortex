import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, getUsuarioActual, scopeEspacioWhere } from "@/lib/auth";
import { getEspaciosMetrics } from "@/lib/espacios/actions";
import { EspaciosClient } from "./espacios-client";
import type { EspacioConMetrics } from "@/types/espacio";

export default async function EspaciosPage() {
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

  const metricsPorEspacio = await getEspaciosMetrics(todosLosEspacios.map((e) => e.id));

  const espaciosConMetrics: EspacioConMetrics[] = todosLosEspacios.map((e) => ({
    ...e,
    ...metricsPorEspacio[e.id],
  }));

  const canEdit = usuario?.rol === "superadmin";

  return <EspaciosClient initialEspacios={espaciosConMetrics} canEdit={canEdit} />;
}
