import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, getUsuarioActual, scopeEspacioWhere } from "@/lib/auth";
import { EspaciosClient } from "./espacios-client";
import type { Espacio } from "@/types/espacio";

export default async function EspaciosPage() {
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  // Un tester no tiene alcance a nivel Espacio en absoluto.
  if (usuario?.rol === "tester") {
    redirect("/proyectos");
  }

  const espacios = await prisma.espacio.findMany({
    where: {
      activo: true,
      ...(usuario ? scopeEspacioWhere(usuario) : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const conteos = await prisma.proyecto.groupBy({
    by: ["espacioId"],
    where: { activo: true, espacioId: { in: espacios.map((e) => e.id) } },
    _count: { _all: true },
  });
  const proyectoCounts: Record<string, number> = {};
  for (const c of conteos) {
    proyectoCounts[c.espacioId] = c._count._all;
  }

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
        <EspaciosClient
          initialEspacios={espacios as Espacio[]}
          proyectoCounts={proyectoCounts}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}
