/**
 * AES-256-GCM crypto helpers para Credencial.valor.
 *
 * Versionado de clave (SEG-12):
 *   - v1 (legacy): key = scrypt(SESSION_SECRET, 'acta-credencial-salt', 32)
 *   - v2 (actual):  key = scrypt(CREDENCIALES_ENCRYPTION_KEY, 'acta-credencial-v2', 32)
 *     Prefijo 'v2:' en el ciphertext output. Si CREDENCIALES_ENCRYPTION_KEY no está
 *     definida se usa v1 (compatibilidad hacia atrás). Ambos derivan con scrypt
 *     para resistir rainbow tables.
 *   - nonce: 12 bytes random, prepended al ciphertext
 *   - output: [v2:] nonce(12) || ciphertext(N) || authTag(16)
 *   - tampered ciphertext/nonce/tag → decrypt throws (auth tag mismatch)
 *
 * Esta función se llama server-side (Next.js routes + recorder-worker).
 * NO exponer `valor` directamente al cliente.
 *
 * lib/env.ts (de otro agente) valida CREDENCIALES_ENCRYPTION_KEY como opcional.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT_V1 = "acta-credencial-salt";
const SALT_V2 = "acta-credencial-v2";
const KEY_LEN = 32; // 256 bits
const NONCE_LEN = 12; // GCM standard
const TAG_LEN = 16; // GCM auth tag
const ALGO = "aes-256-gcm";
const V2_PREFIX = "v2:";

const _credencialesKey = process.env.CREDENCIALES_ENCRYPTION_KEY;

// scrypt es caro a propósito: se deriva una vez por proceso, no en cada cifrado o descifrado.
let keyV1: Buffer | null = null;
let keyV2: Buffer | null = null;
let avisoV1 = false;

/** Derived key v1 (legacy, SESSION_SECRET). */
function getKeyV1(): Buffer {
  if (keyV1) return keyV1;
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET es requerido (>=32 chars) para cifrar/descifrar credenciales",
    );
  }
  keyV1 = scryptSync(secret, SALT_V1, KEY_LEN);
  return keyV1;
}

/** Derived key v2 (CREDENCIALES_ENCRYPTION_KEY). */
function getKeyV2(): Buffer {
  if (keyV2) return keyV2;
  if (!_credencialesKey) {
    throw new Error("CREDENCIALES_ENCRYPTION_KEY no está definida");
  }
  keyV2 = scryptSync(_credencialesKey, SALT_V2, KEY_LEN);
  return keyV2;
}

/**
 * Cifra un plaintext (string) y devuelve un Buffer con `nonce || ciphertext || authTag`.
 * El nonce se genera aleatoriamente por cada llamada (12 bytes GCM standard).
 *
 * Usa v2 si CREDENCIALES_ENCRYPTION_KEY está definida, si no v1 (legacy).
 * Lanza Error si no hay clave disponible.
 */
export function encryptCredencial(plain: string): Buffer {
  const useV2 = Boolean(_credencialesKey);
  if (!useV2) {
    // v1 ata las credenciales al secreto de las cookies: en producción no se crean credenciales nuevas así.
    if (process.env.NODE_ENV === "production") {
      throw new Error("Define CREDENCIALES_ENCRYPTION_KEY (>= 32 caracteres) para guardar credenciales");
    }
    if (!avisoV1) {
      avisoV1 = true;
      console.warn("[credenciales] CREDENCIALES_ENCRYPTION_KEY no está definida: se cifra con la clave derivada de SESSION_SECRET (sólo desarrollo).");
    }
  }
  const key = useV2 ? getKeyV2() : getKeyV1();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv(ALGO, key, nonce);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: [v2:] nonce(12) || ciphertext(N) || authTag(16)
  const body = Buffer.concat([nonce, ct, tag]);
  return useV2 ? Buffer.concat([Buffer.from(V2_PREFIX), body]) : body;
}

/**
 * Descifra un Buffer producido por `encryptCredencial`.
 * Detecta la versión por el prefijo 'v2:' y deriva la clave correspondiente.
 * Lanza Error si el auth tag no verifica (tampering, key incorrecta, nonce alterado).
 */
export function decryptCredencial(ciphertext: Buffer): string {
  const isV2 = ciphertext.slice(0, V2_PREFIX.length).toString() === V2_PREFIX;
  const data = isV2 ? ciphertext.subarray(V2_PREFIX.length) : ciphertext;

  if (data.length < NONCE_LEN + TAG_LEN) {
    throw new Error("Ciphertext demasiado corto: debe incluir nonce(12) + authTag(16)");
  }

  const key = isV2 ? getKeyV2() : getKeyV1();
  const nonce = data.subarray(0, NONCE_LEN);
  const tag = data.subarray(data.length - TAG_LEN);
  const ct = data.subarray(NONCE_LEN, data.length - TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}