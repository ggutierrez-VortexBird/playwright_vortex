import { timingSafeEqual } from "node:crypto";

/** Compara un secreto en tiempo constante; `timingSafeEqual` lanza si las longitudes difieren, por eso se chequean antes. */
export function secretoValido(recibido: string | null | undefined, esperado: string): boolean {
  if (!recibido || !esperado) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
