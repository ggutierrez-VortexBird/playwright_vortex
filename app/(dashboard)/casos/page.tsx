import { prisma } from "@/lib/db";
import { getSession, getUsuarioActual, scopeProyectoWhere } from "@/lib/auth";
import { listCasos } from "@/lib/casos/actions";
import { CasosClient } from "./casos-client";
import type { CasoPruebaListItem } from "@/types/caso";

interface ProyectoOption {
  id: string;
  nombre: string;
  espacioNombre: string;
}

interface CasosPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function CasosPage({ searchParams }: CasosPageProps) {
  const { q } = await searchParams;
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  const [casosSinFiltrar, proyectos] = await Promise.all([
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

  const query = q?.trim().toLowerCase();
  const casos = query
    ? casosSinFiltrar.filter(
        (c) => c.nombre.toLowerCase().includes(query) || c.codigo.toLowerCase().includes(query)
      )
    : casosSinFiltrar;

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
      <CasosClient
        casosIniciales={casos}
        canEdit={canEdit}
        proyectos={proyectosOptions}
      />
    </div>
  );
}
