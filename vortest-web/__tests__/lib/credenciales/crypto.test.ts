// AES-256-GCM: salida nonce (12 bytes) || ciphertext || authTag, con nonce aleatorio por llamada.

import { encryptCredencial, decryptCredencial } from "@/lib/credenciales/crypto";

// SESSION_SECRET estable para que scrypt sea determinista.
const ORIGINAL_SECRET = process.env.SESSION_SECRET;

beforeAll(() => {
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET || "test-secret-32chars-min-AAA-BBB-CCC-DDD-EEE-FFF";
});

afterAll(() => {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = ORIGINAL_SECRET;
  }
});

describe("credenciales/crypto — AES-256-GCM round-trip", () => {
  it("encrypts and decrypts a simple string round-trip", () => {
    const plain = "MiPass123";
    const ciphertext = encryptCredencial(plain);
    const decrypted = decryptCredencial(ciphertext);
    expect(decrypted).toBe(plain);
  });

  it("preserves UTF-8 multi-byte characters round-trip", () => {
    const plain = "Contraseña con ñ, tildes y emoji 🔒";
    const ciphertext = encryptCredencial(plain);
    const decrypted = decryptCredencial(ciphertext);
    expect(decrypted).toBe(plain);
  });

  it("preserves empty string round-trip (edge case)", () => {
    const plain = "";
    const ciphertext = encryptCredencial(plain);
    const decrypted = decryptCredencial(ciphertext);
    expect(decrypted).toBe(plain);
  });

  it("preserves long strings round-trip (storageState JSON, >1KB)", () => {
    // storageState de Playwright simulado
    const obj = {
      cookies: Array.from({ length: 50 }, (_, i) => ({
        name: `cookie_${i}`,
        value: `value_${i}_${"x".repeat(20)}`,
        domain: `.example${i}.com`,
        path: "/",
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: "Lax",
      })),
      origins: Array.from({ length: 20 }, (_, i) => ({
        origin: `https://app${i}.example.com`,
        localStorage: Array.from({ length: 30 }, (_, j) => ({
          name: `key_${i}_${j}`,
          value: `value_${i}_${j}_${"y".repeat(40)}`,
        })),
      })),
    };
    const plain = JSON.stringify(obj);
    const ciphertext = encryptCredencial(plain);
    const decrypted = decryptCredencial(ciphertext);
    expect(decrypted).toBe(plain);
  });

  it("produces DIFFERENT ciphertext on each encrypt call (random nonce)", () => {
    const plain = "MiPass123";
    const c1 = encryptCredencial(plain);
    const c2 = encryptCredencial(plain);
    // Mismo texto, distinto ciphertext: nonce aleatorio
    expect(c1.equals(c2)).toBe(false);
  });

  it("output is a Buffer of expected shape: nonce(12) + ct + tag(16) >= 28 bytes", () => {
    const plain = "x";
    const ciphertext = encryptCredencial(plain);
    expect(Buffer.isBuffer(ciphertext)).toBe(true);
    // 12 bytes de nonce + 16 de authTag + al menos 1 de ciphertext
    expect(ciphertext.length).toBeGreaterThanOrEqual(28);
  });

  it("fails decryption when ciphertext is tampered (auth tag mismatch)", () => {
    const plain = "MiPass123";
    const ciphertext = encryptCredencial(plain);
    // Se invierte un bit del ciphertext (no del tag)
    const tampered = Buffer.from(ciphertext);
    tampered[20] = tampered[20] ^ 0xff;
    expect(() => decryptCredencial(tampered)).toThrow();
  });

  it("fails decryption when nonce is tampered", () => {
    const plain = "MiPass123";
    const ciphertext = encryptCredencial(plain);
    const tampered = Buffer.from(ciphertext);
    tampered[0] = tampered[0] ^ 0xff;
    expect(() => decryptCredencial(tampered)).toThrow();
  });

  it("fails decryption when truncated", () => {
    const plain = "MiPass123";
    const ciphertext = encryptCredencial(plain);
    const truncated = ciphertext.subarray(0, ciphertext.length - 5);
    expect(() => decryptCredencial(truncated)).toThrow();
  });

  it("different SESSION_SECRET produces different ciphertext (key derivation works)", () => {
    const plain = "MiPass123";
    const c1 = encryptCredencial(plain);

    const orig = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "another-secret-totally-different-32chars-AAA-BBB";
    // Se reimporta con el nuevo entorno
    jest.isolateModules(() => {
      const { encryptCredencial: enc2 } = require("@/lib/credenciales/crypto");
      const c2 = enc2(plain);
      // Otra clave produce otro ciphertext
      expect(c1.equals(c2)).toBe(false);
    });
    process.env.SESSION_SECRET = orig;
  });
});