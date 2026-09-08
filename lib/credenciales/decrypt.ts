/**
 * Helper de descifrado + JSON.parse en una sola llamada.
 * Usado por el recorder-worker para obtener el storageState desde una Credencial.
 *
 * Retorna null si el ciphertext es inválido, el JSON no parsea, o el resultado
 * no es un objeto (no aceptamos arrays/primitives como storageState).
 */
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