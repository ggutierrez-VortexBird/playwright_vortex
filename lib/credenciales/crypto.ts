/**
 * AES-256-GCM crypto helpers para Credencial.valor.
 *
 * Contrato (design.md §Crypto):
 *   - key = scrypt(SESSION_SECRET, 'acta-credencial-salt', 32)
 *   - nonce: 12 bytes random, prepended al ciphertext
 *   - output: nonce(12) || ciphertext(N) || authTag(16)
 *   - tampered ciphertext/nonce/tag → decrypt throws (auth tag mismatch)
 *
 * Esta función se llama server-side (Next.js routes + recorder-worker).
 * NO exponer `valor` directamente al cliente.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT = "acta-credencial-salt";
const KEY_LEN = 32; // 256 bits
const NONCE_LEN = 12; // GCM standard
const TAG_LEN = 16; // GCM auth tag
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET es requerido (>=32 chars) para cifrar/descifrar credenciales",
    );
  }
  // scryptSync es síncrono y rápido para una key derivada por proceso (cacheamos).
  return scryptSync(secret, SALT, KEY_LEN);
}

/**
 * Cifra un plaintext (string) y devuelve un Buffer con `nonce || ciphertext || authTag`.
 * El nonce se genera aleatoriamente por cada llamada (12 bytes GCM standard).
 *
 * Lanza Error si SESSION_SECRET no está definida o es muy corta.
 */
export function encryptCredencial(plain: string): Buffer {
  const key = getKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv(ALGO, key, nonce);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: nonce(12) || ciphertext(N) || authTag(16)
  return Buffer.concat([nonce, ct, tag]);
}

/**
 * Descifra un Buffer producido por `encryptCredencial`.
 * Lanza Error si el auth tag no verifica (tampering, key incorrecta, nonce alterado).
 */
export function decryptCredencial(ciphertext: Buffer): string {
  if (ciphertext.length < NONCE_LEN + TAG_LEN) {
    throw new Error("Ciphertext demasiado corto: debe incluir nonce(12) + authTag(16)");
  }
  const key = getKey();
  const nonce = ciphertext.subarray(0, NONCE_LEN);
  const tag = ciphertext.subarray(ciphertext.length - TAG_LEN);
  const ct = ciphertext.subarray(NONCE_LEN, ciphertext.length - TAG_LEN);

  const decipher = createDecipheriv(ALGO, key, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}