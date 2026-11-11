// AES-256-GCM para Credencial.valor; clave v2 (CREDENCIALES_ENCRYPTION_KEY, prefijo 'v2:') o v1 legacy (SESSION_SECRET). Solo servidor.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const SALT_V1 = "acta-credencial-salt";
const SALT_V2 = "acta-credencial-v2";
const KEY_LEN = 32; // 256 bits
const NONCE_LEN = 12; // estándar GCM
const TAG_LEN = 16; // tag de autenticación GCM
const ALGO = "aes-256-gcm";
const V2_PREFIX = "v2:";

const _credencialesKey = process.env.CREDENCIALES_ENCRYPTION_KEY;

// scrypt es caro a propósito: se deriva una vez por proceso, no en cada cifrado o descifrado.
let keyV1: Buffer | null = null;
let keyV2: Buffer | null = null;
let avisoV1 = false;

/** Clave derivada v1 (legacy, SESSION_SECRET). */
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

/** Clave derivada v2 (CREDENCIALES_ENCRYPTION_KEY). */
function getKeyV2(): Buffer {
  if (keyV2) return keyV2;
  if (!_credencialesKey) {
    throw new Error("CREDENCIALES_ENCRYPTION_KEY no está definida");
  }
  keyV2 = scryptSync(_credencialesKey, SALT_V2, KEY_LEN);
  return keyV2;
}

/** Cifra un string y devuelve `nonce || ciphertext || authTag`; usa v2 si hay CREDENCIALES_ENCRYPTION_KEY, si no v1; lanza sin clave. */
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
  // Formato: [v2:] nonce(12) || ciphertext(N) || authTag(16)
  const body = Buffer.concat([nonce, ct, tag]);
  return useV2 ? Buffer.concat([Buffer.from(V2_PREFIX), body]) : body;
}

/** Descifra un Buffer de `encryptCredencial`; la versión se detecta por el prefijo 'v2:'; lanza si el auth tag no verifica. */
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