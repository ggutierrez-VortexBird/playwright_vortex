import { prisma } from "@/lib/db";
import { getSession, getUsuarioActual, scopeProyectoWhere } from "@/lib/auth";
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
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  const [casos, proyectos] = await Promise.all([
    listCasos(undefined, usuario),
    prisma.proyecto.findMany({
      where: {
        activo: true,
        ...(usuario ? scopeProyectoWhere(usuario) : {}),
      },
      include: { espacio: { select: { nombre: true } } },
      orderBy: { nombre: "asc" },
    }),
  ]);

  // Casos y Ejecuciones los puede crear/editar cualquier rol autenticado
  // con acceso al proyecto puntual — el guard real vive en la acción
  // (`requireProyectoAccess`), acá solo controla si se muestran los botones.
  const canEdit = Boolean(usuario);

  const proyectosOptions: ProyectoOption[] = proyectos.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    espacioNombre: p.espacio.nombre,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Casos de prueba</h2>
        <ScopeBar espacioNombre="Todos los casos" />
        <span className="ml-auto" />
      </div>
      <CasosClient
        casosIniciales={casos}
        canEdit={canEdit}
        proyectos={proyectosOptions}
      />
    </div>
  );
}
