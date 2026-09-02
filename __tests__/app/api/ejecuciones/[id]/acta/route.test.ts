// __tests__/app/api/ejecuciones/[id]/acta/route.test.ts
// HU-G19 — tests para POST /api/ejecuciones/[id]/acta
//
// Mockeamos Prisma y Playwright para no requerir browser real.

import { POST } from "@/app/api/ejecuciones/[id]/acta/route";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...((init?.headers as Record<string, string>) || {}),
        },
      }),
  },
}));

const mockGetSession = jest.fn();
const mockRequireSuperadmin = jest.fn();
jest.mock("@/lib/auth", () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
  requireSuperadmin: (...args: unknown[]) => mockRequireSuperadmin(...args),
  FORBIDDEN_ERROR: new Error("FORBIDDEN"),
  NOT_FOUND_ERROR: new Error("NOT_FOUND"),
}));

const mockFindUniqueEjecucion = jest.fn();
const mockActaFindUnique = jest.fn();
const mockActaUpsert = jest.fn();
const mockConsecutivoUpsert = jest.fn();
const mockActaUpdate = jest.fn();
const mockActaCreate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    ejecucion: {
      findUnique: (...args: unknown[]) => mockFindUniqueEjecucion(...args),
    },
    acta: {
      findUnique: (...args: unknown[]) => mockActaFindUnique(...args),
      update: (...args: unknown[]) => mockActaUpdate(...args),
      create: (...args: unknown[]) => mockActaCreate(...args),
    },
    consecutivoAnual: {
      upsert: (...args: unknown[]) => mockConsecutivoUpsert(...args),
    },
  },
}));

// Mock renderActaToPdf para no lanzar Chromium real
jest.mock("@/lib/acta/render-pdf", () => {
  const actual = jest.requireActual("@/lib/acta/render-pdf");
  return {
    ...actual,
    renderActaToPdf: jest.fn(async ({ consecutivo }: { consecutivo: string }) => ({
      pdfPath: `/tmp/storage/actas/${consecutivo}.pdf`,
      consecutivo,
    })),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireSuperadmin.mockResolvedValue(undefined);
});

describe("POST /api/ejecuciones/[id]/acta", () => {
  it("retorna 401 si no hay sesión", async () => {
    mockGetSession.mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ejec-1" }) });
    expect(res.status).toBe(401);
  });

  it("retorna 403 si el usuario no es superadmin", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    // Reject con un Error "FORBIDDEN" — el route handler matchea por mensaje
    // (porque en tests el sentinel mockeado es una instancia distinta).
    mockRequireSuperadmin.mockRejectedValue(new Error("FORBIDDEN"));
    const req = new Request("http://localhost", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ejec-1" }) });
    expect(res.status).toBe(403);
  });

  it("retorna 404 si la ejecución no existe", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    mockFindUniqueEjecucion.mockResolvedValue(null);
    const req = new Request("http://localhost", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ejec-x" }) });
    expect(res.status).toBe(404);
  });

  it("genera acta nueva, calcula consecutivo y persiste Acta con create", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const ejecucionMock = {
      id: "ejec-1",
      estado: "paso",
      inicioAt: new Date("2026-08-12T10:00:00Z"),
      finAt: new Date("2026-08-12T10:02:00Z"),
      duracionMs: 120000,
      errorMsg: null,
      entorno: "QA",
      navegador: "chromium",
      sistemaOperativo: "Linux",
      nodoEjecucion: "node-1",
      asercionesTotal: 0,
      asercionesOk: 0,
      asercionesFail: 0,
      casoPrueba: {
        nombre: "Test",
        codigo: "CP-1",
        origen: "grabador",
        proyecto: {
          nombre: "P",
          ambiente: "QA",
          espacio: { nombre: "E" },
        },
      },
      pasos: [
        { numero: 1, descripcion: "X", estado: "paso", duracionMs: 1000, errorMsg: null },
      ],
    };
    mockFindUniqueEjecucion.mockResolvedValue(ejecucionMock);
    mockActaFindUnique.mockResolvedValue(null); // no acta previa
    mockConsecutivoUpsert.mockResolvedValue({ anio: 2026, ultimo: 5 });
    mockActaCreate.mockResolvedValue({ id: "acta-1" });

    const req = new Request("http://localhost", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ejec-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.consecutivo).toBe("ACE-2026-0005");
    expect(body.actaId).toBe("acta-1");
    expect(body.downloadUrl).toBe("/api/actas/acta-1/download");

    expect(mockConsecutivoUpsert).toHaveBeenCalledTimes(1);
    expect(mockActaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ejecucionId: "ejec-1",
          consecutivo: "ACE-2026-0005",
          rutaPdf: "/tmp/storage/actas/ACE-2026-0005.pdf",
        }),
      }),
    );
    expect(mockActaUpdate).not.toHaveBeenCalled();
  });

  it("regenera acta existente sin incrementar el consecutivo (idempotente)", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const ejecucionMock = {
      id: "ejec-1",
      estado: "paso",
      inicioAt: new Date(),
      finAt: new Date(),
      duracionMs: 1000,
      errorMsg: null,
      entorno: "QA",
      navegador: "chromium",
      sistemaOperativo: "Linux",
      nodoEjecucion: "node-1",
      asercionesTotal: 0,
      asercionesOk: 0,
      asercionesFail: 0,
      casoPrueba: {
        nombre: "T",
        codigo: "C",
        origen: "subirScript",
        proyecto: { nombre: "P", ambiente: "QA", espacio: { nombre: "E" } },
      },
      pasos: [],
    };
    mockFindUniqueEjecucion.mockResolvedValue(ejecucionMock);
    mockActaFindUnique.mockResolvedValue({
      id: "acta-existente",
      consecutivo: "ACE-2026-0001",
    });
    mockActaUpdate.mockResolvedValue({ id: "acta-existente" });

    const req = new Request("http://localhost", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ejec-1" }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.consecutivo).toBe("ACE-2026-0001"); // mismo consecutivo
    expect(body.actaId).toBe("acta-existente");

    expect(mockConsecutivoUpsert).not.toHaveBeenCalled();
    expect(mockActaUpdate).toHaveBeenCalledTimes(1);
    expect(mockActaCreate).not.toHaveBeenCalled();
  });

  it("retorna 500 si el render del PDF falla", async () => {
    mockGetSession.mockResolvedValue({ userId: "user-1" });
    const ejecucionMock = {
      id: "ejec-1",
      estado: "paso",
      inicioAt: null,
      finAt: null,
      duracionMs: null,
      errorMsg: null,
      entorno: null,
      navegador: null,
      sistemaOperativo: null,
      nodoEjecucion: null,
      asercionesTotal: 0,
      asercionesOk: 0,
      asercionesFail: 0,
      casoPrueba: {
        nombre: "T",
        codigo: "C",
        origen: null,
        proyecto: { nombre: "P", ambiente: "QA", espacio: { nombre: "E" } },
      },
      pasos: [],
    };
    mockFindUniqueEjecucion.mockResolvedValue(ejecucionMock);
    mockActaFindUnique.mockResolvedValue(null);
    mockConsecutivoUpsert.mockResolvedValue({ anio: 2026, ultimo: 1 });

    // Override the render mock to throw
    const { renderActaToPdf } = jest.requireMock("@/lib/acta/render-pdf");
    (renderActaToPdf as jest.Mock).mockRejectedValueOnce(new Error("chrome crashed"));

    const req = new Request("http://localhost", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ejec-1" }) });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("render_failed");
  });
});