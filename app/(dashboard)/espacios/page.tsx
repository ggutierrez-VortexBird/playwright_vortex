import { prisma } from "@/lib/db";
import { listEspacios } from "@/lib/espacios/actions";
import { EspaciosClient } from "./espacios-client";
import type { Espacio } from "@/types/espacio";

export default async function EspaciosPage() {
  const espacios = await prisma.espacio.findMany({
    where: { activo: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-headline text-headline-lg text-m3-primary">Espacios</h2>
        <p className="mt-1 font-body text-body-md text-m3-on-surface-variant">
          Organiza tu trabajo por cliente o área. Cada espacio tiene un color
          propio que se propaga a sus proyectos, casos y ejecuciones.
        </p>
      </div>
      <div className="mt-2">
        <EspaciosClient initialEspacios={espacios as Espacio[]} />
      </div>
    </div>
  );
}
