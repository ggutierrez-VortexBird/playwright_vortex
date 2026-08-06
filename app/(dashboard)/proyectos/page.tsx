import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listEspacios } from "@/lib/espacios/actions";
import { listProyectosByEspacio, getMetrics } from "@/lib/proyectos/actions";
import { ProyectosClient } from "./proyectos-client";
import type { ProyectoWithMetrics } from "@/types/proyecto";

async function getProyectosWithMetrics(espacioId: string): Promise<ProyectoWithMetrics[]> {
  const proyectos = await listProyectosByEspacio(espacioId);

  const proyectosWithMetrics = await Promise.all(
    proyectos.map(async (proyecto) => {
      const metrics = await getMetrics(proyecto.id);
      return {
        id: proyecto.id,
        espacioId: proyecto.espacioId,
        nombre: proyecto.nombre,
        ambiente: proyecto.ambiente,
        createdAt: proyecto.createdAt,
        updatedAt: proyecto.updatedAt,
        totalCasos: metrics.totalCasos,
        casosConformes: metrics.casosConformes,
        casosNoConformes: metrics.casosNoConformes,
        fechaUltimaEjecucion: metrics.fechaUltimaEjecucion,
      };
    })
  );

  return proyectosWithMetrics;
}

export default async function ProyectosPage() {
  const [espacios, session] = await Promise.all([
    listEspacios(),
    getSession(),
  ]);

  const isSuperadmin = session?.userId
    ? await prisma.usuario.findUnique({
        where: { id: session.userId },
        select: { rol: true },
      })
    : null;

  const canEdit = isSuperadmin?.rol === "superadmin";

  // Fetch all proyectos with metrics for all espacios
  const proyectosByEspacio = await Promise.all(
    espacios.map((espacio) => getProyectosWithMetrics(espacio.id))
  );
  const todosLosProyectos = proyectosByEspacio.flat();

  return (
    <ProyectosClient
      espacios={espacios}
      proyectosIniciales={todosLosProyectos}
      canEdit={canEdit}
    />
  );
}
