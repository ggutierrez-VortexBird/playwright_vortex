/**
 * Tests for lib/casos/parametros.ts (HU-G12 server-side helpers).
 *
 * Verifies:
 *   - listarParametrosConEnUso computes enUso from current PasoGrabado list.
 *   - Credential params are returned with valorDefecto=null (security).
 *   - actualizarValorDefecto refuses to update credential params.
 *   - actualizarValorDefecto updates and re-computes enUso.
 */

import {
  listarParametrosConEnUso,
  actualizarValorDefecto,
} from "@/lib/casos/parametros";

jest.mock("@/lib/db", () => ({
  prisma: {
    parametroGrabacion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    pasoGrabado: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockParamFindMany = prisma.parametroGrabacion.findMany as unknown as jest.Mock;
const mockParamFindFirst = prisma.parametroGrabacion.findFirst as unknown as jest.Mock;
const mockParamUpdate = prisma.parametroGrabacion.update as unknown as jest.Mock;
const mockPasoFindMany = prisma.pasoGrabado.findMany as unknown as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("listarParametrosConEnUso (HU-G12)", () => {
  it("returns empty array when no params", async () => {
    mockParamFindMany.mockResolvedValue([]);
    mockPasoFindMany.mockResolvedValue([]);
    const out = await listarParametrosConEnUso("caso-1");
    expect(out).toEqual([]);
    expect(mockParamFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { casoPruebaId: "caso-1" } }),
    );
  });

  it("marks enUso=true when {{nombre}} appears in a step descripcion", async () => {
    mockParamFindMany.mockResolvedValue([
      {
        id: "p1",
        nombre: "usuario",
        valorDefecto: "admin",
        origen: "manual",
      },
    ]);
    mockPasoFindMany.mockResolvedValue([
      { descripcion: "Escribir «{{usuario}}»", valor: null },
    ]);
    const out = await listarParametrosConEnUso("caso-1");
    expect(out).toHaveLength(1);
    expect(out[0].enUso).toBe(true);
  });

  it("marks enUso=false when no step references the param", async () => {
    mockParamFindMany.mockResolvedValue([
      {
        id: "p1",
        nombre: "huérfano",
        valorDefecto: "x",
        origen: "manual",
      },
    ]);
    mockPasoFindMany.mockResolvedValue([
      { descripcion: "Clic en «Ingresar»", valor: null },
    ]);
    const out = await listarParametrosConEnUso("caso-1");
    expect(out[0].enUso).toBe(false);
  });

  it("marks enUso=true when {{nombre}} appears in a step valor", async () => {
    mockParamFindMany.mockResolvedValue([
      {
        id: "p1",
        nombre: "saldo",
        valorDefecto: "100",
        origen: "manual",
      },
    ]);
    mockPasoFindMany.mockResolvedValue([
      { descripcion: "Verificar saldo", valor: "El saldo es {{saldo}}" },
    ]);
    const out = await listarParametrosConEnUso("caso-1");
    expect(out[0].enUso).toBe(true);
  });

  it("redacts valorDefecto for credential params (returns null)", async () => {
    mockParamFindMany.mockResolvedValue([
      {
        id: "p1",
        nombre: "pwd",
        valorDefecto: "supersecret",
        origen: "credencial",
      },
    ]);
    mockPasoFindMany.mockResolvedValue([]);
    const out = await listarParametrosConEnUso("caso-1");
    expect(out[0].valorDefecto).toBeNull();
    expect(out[0].origen).toBe("credencial");
  });

  it("preserves valorDefecto for manual params", async () => {
    mockParamFindMany.mockResolvedValue([
      {
        id: "p1",
        nombre: "x",
        valorDefecto: "abc",
        origen: "manual",
      },
    ]);
    mockPasoFindMany.mockResolvedValue([]);
    const out = await listarParametrosConEnUso("caso-1");
    expect(out[0].valorDefecto).toBe("abc");
  });
});

describe("actualizarValorDefecto (HU-G12)", () => {
  it("returns null when param does not exist", async () => {
    mockParamFindFirst.mockResolvedValue(null);
    const out = await actualizarValorDefecto("caso-1", "p1", "x");
    expect(out).toBeNull();
    expect(mockParamUpdate).not.toHaveBeenCalled();
  });

  it("returns null when param belongs to another caso (cross-case rejected)", async () => {
    mockParamFindFirst.mockResolvedValue(null);
    const out = await actualizarValorDefecto("caso-1", "p1", "x");
    expect(out).toBeNull();
    expect(mockParamUpdate).not.toHaveBeenCalled();
  });

  it("returns null when param is credential-backed (not editable)", async () => {
    mockParamFindFirst.mockResolvedValue({
      id: "p1",
      nombre: "pwd",
      valorDefecto: "x",
      origen: "credencial",
    });
    const out = await actualizarValorDefecto("caso-1", "p1", "newval");
    expect(out).toBeNull();
    expect(mockParamUpdate).not.toHaveBeenCalled();
  });

  it("updates valorDefecto and re-computes enUso=true", async () => {
    mockParamFindFirst.mockResolvedValue({
      id: "p1",
      nombre: "usuario",
      valorDefecto: "old",
      origen: "manual",
    });
    mockParamUpdate.mockResolvedValue({
      id: "p1",
      nombre: "usuario",
      valorDefecto: "newval",
      origen: "manual",
    });
    mockPasoFindMany.mockResolvedValue([
      { descripcion: "Escribir «{{usuario}}»", valor: null },
    ]);
    const out = await actualizarValorDefecto("caso-1", "p1", "newval");
    expect(out).not.toBeNull();
    expect(out?.valorDefecto).toBe("newval");
    expect(out?.enUso).toBe(true);
  });

  it("updates valorDefecto to null when input is null", async () => {
    mockParamFindFirst.mockResolvedValue({
      id: "p1",
      nombre: "usuario",
      valorDefecto: "old",
      origen: "manual",
    });
    mockParamUpdate.mockResolvedValue({
      id: "p1",
      nombre: "usuario",
      valorDefecto: null,
      origen: "manual",
    });
    mockPasoFindMany.mockResolvedValue([]);
    const out = await actualizarValorDefecto("caso-1", "p1", null);
    expect(out?.valorDefecto).toBeNull();
    expect(out?.enUso).toBe(false);
  });
});