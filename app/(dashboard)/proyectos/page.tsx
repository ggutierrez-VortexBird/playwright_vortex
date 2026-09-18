import { getSession, getUsuarioActual } from "@/lib/auth";
import { listEspacios } from "@/lib/espacios/actions";
import { listProyectosActivos, getMetrics } from "@/lib/proyectos/actions";
import { ProyectosClient } from "./proyectos-client";
import type { ProyectoWithMetrics } from "@/types/proyecto";

export default async function ProyectosPage() {
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  // listProyectosActivos ya aplica el alcance correcto por rol: superadmin
  // ve todo, admin los de sus espacios, tester solo los suyos asignados
  // (esto es lo que le da visibilidad aunque no tenga acceso a Espacios).
  const [espacios, proyectos] = await Promise.all([
    listEspacios(usuario),
    listProyectosActivos(usuario),
  ]);

  const canEdit = usuario?.rol === "superadmin" || usuario?.rol === "admin";

  const todosLosProyectos: ProyectoWithMetrics[] = await Promise.all(
    proyectos.map(async (proyecto) => {
      const metrics = await getMetrics(proyecto.id);
      return {
        id: proyecto.id,
        espacioId: proyecto.espacioId,
        nombre: proyecto.nombre,
        ambiente: proyecto.ambiente,
        descripcion: proyecto.descripcion,
        versionSistema: proyecto.versionSistema,
        color: proyecto.color,
        activo: proyecto.activo,
        createdAt: proyecto.createdAt,
        updatedAt: proyecto.updatedAt,
        totalCasos: metrics.totalCasos,
        casosConformes: metrics.casosConformes,
        casosNoConformes: metrics.casosNoConformes,
        fechaUltimaEjecucion: metrics.fechaUltimaEjecucion,
      };
    })
  );

  return (
    <ProyectosClient
      espacios={espacios}
      proyectosIniciales={todosLosProyectos}
      canEdit={canEdit}
    />
  );
}
