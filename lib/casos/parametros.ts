/**
 * lib/casos/parametros.ts — server-side helpers for ParametroGrabacion
 * attached to a CasoPrueba (HU-G12).
 *
 * Why a separate helper?
 *  - The `enUso` flag is stored as a boolean on ParametroGrabacion but is
 *    a derived value: a param is "in use" iff at least one current step
 *    references it as `{{nombre}}`. We recompute it on read so the UI
 *    always reflects the current step list (which can be edited during
 *    the review screen).
 *  - Credential-backed parameters are masked at the API boundary so the
 *     UI never receives the plaintext value when listing for editing.
 *
 * NOTE: this module is Node-only. Do not import in client components.
 */

import { prisma } from "@/lib/db";

export interface ParametroConEnUso {
  id: string;
  nombre: string;
  /** Plain value for manual params, `null` for credential params. */
  valorDefecto: string | null;
  origen: string;
  enUso: boolean;
}

/**
 * Returns the parameters of a CasoPrueba with `enUso` computed from the
 * current PasoGrabado list (those bound to this casoPruebaId).
 *
 * Rules:
 *   - A param is "en uso" iff at least one PasoGrabado (linked to the
 *     same casoPruebaId) contains `{{nombre}}` in either descripcion
 *     or valor.
 *   - Credential-backed params are returned with `valorDefecto=null`
 *     to avoid leaking the plaintext to the API consumer. The UI knows
 *     to render them masked.
 */
export async function listarParametrosConEnUso(
  casoPruebaId: string,
): Promise<ParametroConEnUso[]> {
  const [parametros, pasos] = await Promise.all([
    prisma.parametroGrabacion.findMany({
      where: { casoPruebaId },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        valorDefecto: true,
        origen: true,
      },
    }),
    prisma.pasoGrabado.findMany({
      where: { casoPruebaId },
      orderBy: { numero: "asc" },
      select: { descripcion: true, valor: true },
    }),
  ]);

  return parametros.map((p) => {
    const token = `{{${p.nombre}}}`;
    const enUso = pasos.some(
      (paso) =>
        (paso.descripcion != null && paso.descripcion.includes(token)) ||
        (paso.valor != null && paso.valor.includes(token)),
    );
    return {
      id: p.id,
      nombre: p.nombre,
      // SECURITY: never expose credential plaintext over the wire.
      valorDefecto: p.origen === "credencial" ? null : p.valorDefecto,
      origen: p.origen,
      enUso,
    };
  });
}

/**
 * Updates the valorDefecto of a ParametroGrabacion, enforcing that:
 *   - The param belongs to the given casoPruebaId (no cross-case writes).
 *   - Credential-backed params are NOT editable (returns 403 equivalent).
 *
 * Returns the updated row, or null if not found / not editable.
 */
export async function actualizarValorDefecto(
  casoPruebaId: string,
  paramId: string,
  valorDefecto: string | null,
): Promise<ParametroConEnUso | null> {
  const existing = await prisma.parametroGrabacion.findFirst({
    where: { id: paramId, casoPruebaId },
    select: { id: true, nombre: true, valorDefecto: true, origen: true },
  });
  if (!existing) return null;
  if (existing.origen === "credencial") {
    // Reject silently — caller should treat as forbidden.
    return null;
  }
  const updated = await prisma.parametroGrabacion.update({
    where: { id: paramId },
    data: { valorDefecto },
    select: { id: true, nombre: true, valorDefecto: true, origen: true },
  });
  // Re-compute enUso for consistency with the list endpoint.
  const token = `{{${updated.nombre}}}`;
  const pasos = await prisma.pasoGrabado.findMany({
    where: { casoPruebaId },
    select: { descripcion: true, valor: true },
  });
  const enUso = pasos.some(
    (p) =>
      (p.descripcion != null && p.descripcion.includes(token)) ||
      (p.valor != null && p.valor.includes(token)),
  );
  return {
    id: updated.id,
    nombre: updated.nombre,
    valorDefecto: updated.valorDefecto,
    origen: updated.origen,
    enUso,
  };
}