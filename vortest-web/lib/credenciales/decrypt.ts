/** Descifra y parsea el storageState de una Credencial; devuelve null si es inválido o no es un objeto. */
import { decryptCredencial } from "./crypto";

export function decryptCredencialJson<T = unknown>(ciphertext: Buffer): T | null {
  let plain: string;
  try {
    plain = decryptCredencial(ciphertext);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(plain);
  } catch {
    return null;
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return parsed as T;
}