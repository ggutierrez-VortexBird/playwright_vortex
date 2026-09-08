/**
 * Tests for /api/casos/[id]/juego-de-datos (HU-G13).
 *
 * Verifies:
 *   - GET returns 401 when not authenticated.
 *   - GET returns 404 when caso does not exist.
 *   - GET returns existing juegos ordered by createdAt desc.
 *   - POST requires auth + multipart/form-data.
 *   - POST rejects empty archivo.
 *   - POST validates against caso's ParametroGrabacion names.
 *   - POST creates a JuegoDeDatos and returns preview.
 *   - POST replaces previous JuegoDeDatos (1-a-1 MVP).
 */

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...((init?.headers as Record<string, string>) || {}) },
      }),
  },
}));

import { POST, GET } from "@/app/api/casos/[id]/juego-de-datos/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    casoPrueba: { findUnique: jest.fn() },
    parametroGrabacion: { findMany: jest.fn() },
    juegoDeDatos: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const mockGetSession = getSession as unknown as jest.Mock;
const mockCasoFindUnique = prisma.casoPrueba.findUnique as unknown as jest.Mock;
const mockParamsFindMany = prisma.parametroGrabacion.findMany as unknown as jest.Mock;
const mockJuegoFindMany = prisma.juegoDeDatos.findMany as unknown as jest.Mock;
const mockJuegoCreate = prisma.juegoDeDatos.create as unknown as jest.Mock;
const mockJuegoDeleteMany = prisma.juegoDeDatos.deleteMany as unknown as jest.Mock;

// Polyfill File.prototype.text — jsdom doesn't include it.
if (!File.prototype.text) {
  Object.defineProperty(File.prototype, "text", {
    value: function (this: File & { __text?: string }) {
      // Stored text fallback (jsdom has no real Blob backing).
      if (this.__text !== undefined) return Promise.resolve(this.__text);
      return Promise.resolve("");
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSession.mockResolvedValue({ userId: "user-1" });
  mockCasoFindUnique.mockResolvedValue({ id: "caso-1" });
});

function makeFormData(file: File | null): Request {
  const formData = new Map<string, File>();
  if (file) formData.set("archivo", file);
  return {
    formData: jest.fn().mockResolvedValue({
      get: (key: string) => formData.get(key) ?? null,
    }),
  } as unknown as Request;
}

function makeCsvFile(text: string, name = "data.csv"): File {
  const file = new File([text], name, { type: "text/csv" }) as File & {
    __text?: string;
  };
  // Store the text so the File.prototype.text polyfill can return it.
  file.__text = text;
  return file;
}

describe("GET /api/casos/[id]/juego-de-datos", () => {
  it("retorna 401 sin autenticación", async () => {
    mockGetSession.mockResolvedValue({ userId: null });
    const res = await GET(
      new Request("http://localhost/api/casos/caso-1/juego-de-datos"),
      { params: Promise.resolve({ id: "caso-1" }) },
    );
    expect(res.status).toBe(401);
  });

  it("retorna 404 si el caso no existe", async () => {
    mockCasoFindUnique.mockResolvedValue(null);
    const res = await GET(
      new Request("http://localhost/api/casos/missing/juego-de-datos"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    expect(res.status).toBe(404);
  });

  it("retorna lista vacía cuando no hay juegos", async () => {
    mockJuegoFindMany.mockResolvedValue([]);
    const res = await GET(
      new Request("http://localhost/api/casos/caso-1/juego-de-datos"),
      { params: Promise.resolve({ id: "caso-1" }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { juegos: unknown[] };
    expect(body.juegos).toEqual([]);
  });
});

describe("POST /api/casos/[id]/juego-de-datos", () => {
  it("retorna 401 sin autenticación", async () => {
    mockGetSession.mockResolvedValue({ userId: null });
    const req = makeFormData(makeCsvFile("a,b\n1,2\n"));
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(401);
  });

  it("retorna 404 si el caso no existe", async () => {
    mockCasoFindUnique.mockResolvedValue(null);
    const req = makeFormData(makeCsvFile("a,b\n1,2\n"));
    const res = await POST(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("retorna 400 cuando falta el campo 'archivo'", async () => {
    const req = makeFormData(null);
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("archivo");
  });

  it("retorna 400 cuando el archivo está vacío", async () => {
    const req = makeFormData(makeCsvFile(""));
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(400);
  });

  it("retorna 400 (csv_validation) cuando faltan columnas esperadas", async () => {
    mockParamsFindMany.mockResolvedValue([
      { nombre: "usuario" },
      { nombre: "saldo" },
    ]);
    const csv = "usuario\nadmin\n";
    const req = makeFormData(makeCsvFile(csv));
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; message: string };
    expect(body.error).toBe("csv_validation");
    expect(body.message).toContain("saldo");
  });

  it("retorna 400 (csv_validation) cuando sobra una columna", async () => {
    mockParamsFindMany.mockResolvedValue([{ nombre: "usuario" }]);
    const csv = "usuario,extra\nadmin,foo\n";
    const req = makeFormData(makeCsvFile(csv));
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { message: string };
    expect(body.message).toContain("extra");
  });

  it("crea el JuegoDeDatos cuando el CSV es válido", async () => {
    mockParamsFindMany.mockResolvedValue([
      { nombre: "usuario" },
      { nombre: "saldo" },
    ]);
    mockJuegoDeleteMany.mockResolvedValue({ count: 0 });
    mockJuegoCreate.mockResolvedValue({
      id: "jd-1",
      nombreArchivo: "data.csv",
      createdAt: new Date("2026-09-01T12:00:00Z"),
    });
    const csv = "usuario,saldo\nadmin,100\nadmin,200\n";
    const req = makeFormData(makeCsvFile(csv));
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      juego: { id: string };
      headers: string[];
      previewRows: Array<Record<string, string>>;
    };
    expect(body.juego.id).toBe("jd-1");
    expect(body.headers).toEqual(["usuario", "saldo"]);
    expect(body.previewRows).toEqual([
      { usuario: "admin", saldo: "100" },
      { usuario: "admin", saldo: "200" },
    ]);
    expect(mockJuegoDeleteMany).toHaveBeenCalledWith({
      where: { casoPruebaId: "caso-1" },
    });
    expect(mockJuegoCreate).toHaveBeenCalled();
  });

  it("reemplaza el juego anterior (1-a-1 MVP)", async () => {
    mockParamsFindMany.mockResolvedValue([{ nombre: "x" }]);
    mockJuegoDeleteMany.mockResolvedValue({ count: 1 });
    mockJuegoCreate.mockResolvedValue({
      id: "jd-2",
      nombreArchivo: "data.csv",
      createdAt: new Date(),
    });
    const req = makeFormData(makeCsvFile("x\n1\n"));
    await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(mockJuegoDeleteMany).toHaveBeenCalledWith({
      where: { casoPruebaId: "caso-1" },
    });
  });
});