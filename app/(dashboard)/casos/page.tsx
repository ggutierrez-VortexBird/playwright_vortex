import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listCasos } from "@/lib/casos/actions";
import { CasosClient } from "./casos-client";
import { ScopeBar } from "@/components/ui/scope-bar";
import type { CasoPruebaListItem } from "@/types/caso";

interface ProyectoOption {
  id: string;
  nombre: string;
  espacioNombre: string;
}

export default async function CasosPage() {
  const [casos, session, proyectos] = await Promise.all([
    listCasos(),
    getSession(),
    prisma.proyecto.findMany({
      where: { activo: true },
      include: { espacio: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const isSuperadmin = session?.userId
    ? await prisma.usuario.findUnique({
        where: { id: session.userId },
        select: { rol: true },
      })
    : null;

  const canEdit = isSuperadmin?.rol === "superadmin";

  const proyectosOptions: ProyectoOption[] = proyectos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    espacioNombre: p.espacio.nombre,
  }));

  return (
    <div className="flex flex-col gap-6">
      <ScopeBar espacioNombre="Casos" />
      <CasosClient
        casosIniciales={casos}
        canEdit={canEdit}
        proyectos={proyectosOptions}
      />
    </div>
  );
}
