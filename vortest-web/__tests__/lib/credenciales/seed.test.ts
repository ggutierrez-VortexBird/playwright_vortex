/**
 * Tests for seedCredencialDemo — idempotent creator of a demo Credencial
 * (storageState vacío para `about:blank`) que permite que el demo funcione
 * out-of-the-box sin requerir credenciales reales.
 *
 * Comportamiento esperado:
 *   - Primera llamada: crea una Credencial con tipo='storageState' y
 *     valor = encryptCredencial(JSON.stringify({cookies:[], origins:[]}))
 *   - Segunda llamada (ya existe): no crea duplicado, retorna la existente
 *   - El valor cifrado descifrado es exactamente {cookies:[], origins:[]}
 *   - Si ya existe una credencial con mismo nombre, NO se duplica
 */

import { decryptCredencialJson } from "@/lib/credenciales/decrypt";

beforeAll(() => {
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET || "test-secret-32chars-min-AAA-BBB-CCC-DDD-EEE-FFF";
});

// Mock prisma — we test the seeding logic, not the DB
const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    credencial: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      create: (...args: unknown[]) => mockCreate(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    proyecto: {
      findFirst: jest.fn().mockResolvedValue({ id: "proyecto-1" }),
    },
  },
}));

import { seedCredencialDemo } from "@/lib/credenciales/seed";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("credenciales/seed — seedCredencialDemo", () => {
  it("creates a demo Credencial when none exists for the project", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "cred-1",
      proyectoId: "proyecto-1",
      nombre: "Demo QA",
      tipo: "storageState",
      valor: Buffer.from("encrypted-blob"),
      sesionVenceAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await seedCredencialDemo("proyecto-1");

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { proyectoId: "proyecto-1", nombre: "Demo QA" },
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        proyectoId: "proyecto-1",
        nombre: "Demo QA",
        tipo: "storageState",
        valor: expect.any(Buffer),
      }),
    });
    expect(result.id).toBe("cred-1");
  });

  it("is idempotent — does not create a duplicate when one already exists", async () => {
    mockFindFirst.mockResolvedValue({
      id: "cred-existing",
      proyectoId: "proyecto-1",
      nombre: "Demo QA",
      tipo: "storageState",
      valor: Buffer.from("already-encrypted"),
      sesionVenceAt: null,
    });

    const result = await seedCredencialDemo("proyecto-1");

    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result.id).toBe("cred-existing");
  });

  it("encrypted value decodes to {cookies:[], origins:[]} — empty storageState for about:blank", async () => {
    mockFindFirst.mockResolvedValue(null);
    let createdValor: Buffer | undefined;
    mockCreate.mockImplementation(async ({ data }: any) => {
      createdValor = data.valor;
      return {
        id: "cred-1",
        proyectoId: "proyecto-1",
        nombre: "Demo QA",
        tipo: "storageState",
        valor: data.valor,
        sesionVenceAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    await seedCredencialDemo("proyecto-1");
    expect(createdValor).toBeDefined();

    const decrypted = decryptCredencialJson<{
      cookies: unknown[];
      origins: unknown[];
    }>(createdValor!);

    expect(decrypted).not.toBeNull();
    expect(decrypted!.cookies).toEqual([]);
    expect(decrypted!.origins).toEqual([]);
  });

  it("uses the supplied proyectoId (does not hardcode a specific one)", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "cred-99",
      proyectoId: "proyecto-XYZ",
      nombre: "Demo QA",
      tipo: "storageState",
      valor: Buffer.from("x"),
      sesionVenceAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await seedCredencialDemo("proyecto-XYZ");

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { proyectoId: "proyecto-XYZ", nombre: "Demo QA" },
    });
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ proyectoId: "proyecto-XYZ" }),
    });
  });

  it("names the demo credencial 'Demo QA' (consistent across runs)", async () => {
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "cred-1",
      proyectoId: "p",
      nombre: "Demo QA",
      tipo: "storageState",
      valor: Buffer.from("x"),
      sesionVenceAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await seedCredencialDemo("p");

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ nombre: "Demo QA" }),
    });
  });
});