import { getUsuarioActual, type SessionData } from "@/lib/auth";
import type { BreadcrumbSegment } from "@/components/breadcrumb-context";

interface ProyectoConEspacio {
  id: string;
  nombre: string;
  espacio?: { id: string; nombre: string } | null;
}

/** Espacio › Proyecto; el espacio sólo enlaza para quien puede abrir su página. Las migas nunca rompen la página: sin rol, va sin enlace. */
export async function migasDeProyecto(session: SessionData, proyecto: ProyectoConEspacio): Promise<BreadcrumbSegment[]> {
  let veEspacio = false;
  try {
    const usuario = await getUsuarioActual(session);
    veEspacio = usuario?.rol === "superadmin" || usuario?.rol === "admin";
  } catch {
    veEspacio = false;
  }
  const espacio = proyecto.espacio;
  return [
    ...(espacio ? [{ label: espacio.nombre, href: veEspacio ? `/espacios/${espacio.id}/proyectos` : undefined }] : []),
    { label: proyecto.nombre, href: `/proyectos/${proyecto.id}/casos` },
  ];
}
