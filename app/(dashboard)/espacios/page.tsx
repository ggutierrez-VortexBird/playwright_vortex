import { prisma } from "@/lib/db";
import { EspaciosClient } from "./espacios-client";
import type { Espacio } from "@/types/espacio";

export default async function EspaciosPage() {
  const espacios = await prisma.espacio.findMany({
    where: { activo: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h2 className="text-xl font-semibold text-ink">Espacios</h2>
      <p className="mt-1 text-ink-3">
        Organiza tu trabajo por cliente o área.
      </p>
      <div className="mt-6">
        <EspaciosClient initialEspacios={espacios as Espacio[]} />
      </div>
    </div>
  );
}
