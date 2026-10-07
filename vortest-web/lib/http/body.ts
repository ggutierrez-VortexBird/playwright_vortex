import type { ZodType } from "zod";
import { AppError } from "@/lib/http/errors";

/**
 * Lee el cuerpo JSON de la petición; si no es JSON válido o no cumple el esquema lanza un AppError 400
 * con un mensaje para el usuario (mapErrorToResponse lo convierte en respuesta).
 */
export async function leerJson<T = unknown>(request: Request, esquema?: ZodType<T>): Promise<T> {
  let datos: unknown;
  try {
    datos = await request.json();
  } catch {
    throw new AppError(400, "validation", "El cuerpo de la petición no es JSON válido");
  }
  if (!esquema) return datos as T;
  const r = esquema.safeParse(datos);
  if (!r.success) {
    const problema = r.error.issues[0];
    const campo = problema?.path.join(".");
    throw new AppError(400, "validation", campo ? `${campo}: ${problema.message}` : problema?.message ?? "Datos inválidos");
  }
  return r.data;
}
