import { getSession, requireProyectoAccess } from "@/lib/auth";

/** Título con el nombre de la entidad sólo si el usuario puede ver su proyecto; si no, uno genérico que no filtra datos. */
export async function tituloConAcceso(proyectoId: string | undefined, titulo: string | undefined, generico: string): Promise<string> {
  if (!proyectoId || !titulo) return generico;
  try {
    await requireProyectoAccess(await getSession(), proyectoId);
    return titulo;
  } catch {
    return generico;
  }
}
