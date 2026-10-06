import { timingSafeEqual } from "node:crypto";

/**
 * Compara un secreto recibido contra el esperado en tiempo constante (SEG-09).
 * `timingSafeEqual` lanza si las longitudes difieren, por eso se chequea antes.
 */
export function secretoValido(recibido: string | null | undefined, esperado: string): boolean {
  if (!recibido || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
