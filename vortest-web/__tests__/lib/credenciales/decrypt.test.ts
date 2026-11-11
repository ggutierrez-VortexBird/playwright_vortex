// decryptCredencialJson descifra y parsea el JSON en un solo paso.

import { encryptCredencial } from "@/lib/credenciales/crypto";
import { decryptCredencialJson } from "@/lib/credenciales/decrypt";

beforeAll(() => {
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET || "test-secret-32chars-min-AAA-BBB-CCC-DDD-EEE-FFF";
});

describe("credenciales/decrypt — JSON helper", () => {
  it("decrypts and parses a JSON storageState", () => {
    const storageState = { cookies: [], origins: [] };
    const ciphertext = encryptCredencial(JSON.stringify(storageState));
    const result = decryptCredencialJson<typeof storageState>(ciphertext);
    expect(result).toEqual(storageState);
  });

  it("returns null/undefined for non-object JSON (array case)", () => {
    const ciphertext = encryptCredencial(JSON.stringify([1, 2, 3]));
    const result = decryptCredencialJson(ciphertext);
    // Los arrays parsean pero se rechazan los no-objetos
    expect(result).toBeNull();
  });

  it("returns null when JSON is invalid", () => {
    // Se cifra un JSON inválido
    const ciphertext = encryptCredencial("{not valid json");
    const result = decryptCredencialJson(ciphertext);
    expect(result).toBeNull();
  });

  it("returns null when JSON is null literal", () => {
    const ciphertext = encryptCredencial("null");
    const result = decryptCredencialJson(ciphertext);
    expect(result).toBeNull();
  });

  it("returns null when JSON is a primitive (string)", () => {
    const ciphertext = encryptCredencial(JSON.stringify("hello"));
    const result = decryptCredencialJson(ciphertext);
    expect(result).toBeNull();
  });

  it("preserves nested structures", () => {
    const obj = {
      cookies: [{ name: "session", value: "abc", domain: ".example.com" }],
      origins: [{ origin: "https://app.example.com", localStorage: [] }],
    };
    const ciphertext = encryptCredencial(JSON.stringify(obj));
    const result = decryptCredencialJson<typeof obj>(ciphertext);
    expect(result).toEqual(obj);
    expect(result?.cookies[0].name).toBe("session");
  });
});