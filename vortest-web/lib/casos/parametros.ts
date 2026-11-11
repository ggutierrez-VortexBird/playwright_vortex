/** Helpers de servidor para ParametroGrabacion de un CasoPrueba; `enUso` se recalcula al leer; solo Node. */

import { prisma } from "@/lib/db";

export interface ParametroConEnUso {
  id: string;
  nombre: string;
  /** Valor para parámetros manuales; `null` para los de credencial. */
  valorDefecto: string | null;
  origen: string;
  enUso: boolean;
}

/** Parámetros de un caso con `enUso` calculado desde sus pasos; los de credencial salen con `valorDefecto=null`. */
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
      // Nunca exponer el valor de una credencial por la red
      valorDefecto: p.origen === "credencial" ? null : p.valorDefecto,
      origen: p.origen,
      enUso,
    };
  });
}

/** Actualiza el valorDefecto de un parámetro del caso; devuelve null si no existe o es de credencial (no editable). */
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
    // Rechazo silencioso: el llamador lo trata como prohibido
    return null;
  }
  const updated = await prisma.parametroGrabacion.update({
    where: { id: paramId },
    data: { valorDefecto },
    select: { id: true, nombre: true, valorDefecto: true, origen: true },
  });
  // Recalcula enUso por consistencia con el listado
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