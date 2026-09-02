/**
 * Tests for POST /api/grabador/sesiones/[id]/guardar (HU-G16).
 */

import { POST } from "@/app/api/grabador/sesiones/[id]/guardar/route";
import { getSession } from "@/lib/auth";

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

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getSession: jest.fn(),
  requireSuperadmin: jest.fn(),
}));

const mockFindUnique = jest.fn();
const mockCasoCreate = jest.fn();
const mockCasoFindFirst = jest.fn();
const mockParamUpdateMany = jest.fn();
const mockPasoUpdateMany = jest.fn();
const mockSesionUpdate = jest.fn();
const mockEjecucionCreate = jest.fn();

const mockTx = {
  casoPrueba: {
    create: (...args: unknown[]) => mockCasoCreate(...args),
  },
  parametroGrabacion: {
    updateMany: (...args: unknown[]) => mockParamUpdateMany(...args),
  },
  pasoGrabado: {
    updateMany: (...args: unknown[]) => mockPasoUpdateMany(...args),
  },
  sesionGrabacion: {
    update: (...args: unknown[]) => mockSesionUpdate(...args),
  },
};

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    casoPrueba: {
      create: (...args: unknown[]) => mockCasoCreate(...args),
      findFirst: (...args: unknown[]) => mockCasoFindFirst(...args),
    },
    parametroGrabacion: {
      updateMany: (...args: unknown[]) => mockParamUpdateMany(...args),
    },
    pasoGrabado: {
      updateMany: (...args: unknown[]) => mockPasoUpdateMany(...args),
    },
    ejecucion: {
      create: (...args: unknown[]) => mockEjecucionCreate(...args),
    },
    $transaction: async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const baseSesion = {
  id: "ses-1",
  usuarioId: "user-1",
  nombre: "Consulta de saldo",
  proyectoId: "proyecto-1",
  estado: "detenida",
  pasos: [
    {
      id: "p1",
      numero: 1,
      tipo: "navegar",
      descripcion: "Abrir portal",
      selectorPrincipal: null,
      selectoresRespaldo: null,
      valor: "https://portal.example.com",
      esValorSensible: false,
      assertionKind: null,
    },
    {
      id: "p2",
      numero: 2,
      tipo: "clic",
      descripcion: "Click en «Login»",
      selectorPrincipal: { tag: "button", testId: "login" },
      selectoresRespaldo: [{ strategy: "testid", value: `[data-testid="login"]` }],
      valor: null,
      esValorSensible: false,
      assertionKind: null,
    },
  ],
  parametros: [{ nombre: "usuario", valorDefecto: "admin" }],
};

describe("POST /api/grabador/sesiones/[id]/guardar (HU-G16)", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not superadmin", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const auth = jest.requireMock("@/lib/auth");
    auth.requireSuperadmin.mockRejectedValueOnce(new Error("FORBIDDEN"));
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ ...baseSesion, usuarioId: "user-2" });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when session is already guardada", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ ...baseSesion, estado: "guardada" });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when session is discarded", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ ...baseSesion, estado: "descartada" });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when session has no pasos", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...baseSesion,
      pasos: [],
    });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("no_pasos");
  });

  it("creates a CasoPrueba with the serialized script and links parametros + pasos", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockCasoFindFirst.mockResolvedValueOnce(null);
    mockCasoCreate.mockResolvedValueOnce({
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-XXXXXX",
      nombre: "Consulta de saldo",
      script: "import { test, expect } from '@playwright/test'; ...",
      scriptFileName: "consulta-de-saldo.spec.ts",
      responsableId: "user-1",
      origen: "grabador",
      activo: true,
    });
    mockParamUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockPasoUpdateMany.mockResolvedValueOnce({ count: 2 });
    mockSesionUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.casoPruebaId).toBe("caso-1");
    expect(data.redirectTo).toBe("/casos/caso-1");

    // The script content should include the navigacion + click on the login button.
    const created = mockCasoCreate.mock.calls[0][0];
    expect(created.data.origen).toBe("grabador");
    expect(created.data.script).toContain("await page.goto(`https://portal.example.com`)");
    expect(created.data.script).toContain("page.getByTestId(`[data-testid=\"login\"]`).click()");
    expect(created.data.script).toContain("usuario: \"admin\"");

    // Parametros and pasos were linked to the new caso.
    expect(mockParamUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sesionId: "ses-1" },
        data: { casoPruebaId: "caso-1", sesionId: null },
      }),
    );
    expect(mockPasoUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sesionId: "ses-1" },
        data: { casoPruebaId: "caso-1" },
      }),
    );
    // Sesion was marked guardada.
    expect(mockSesionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ses-1" },
        data: expect.objectContaining({
          estado: "guardada",
          casoPruebaId: "caso-1",
        }),
      }),
    );
  });

  it("with ?ejecutar=true enqueues an Ejecucion and redirects to /ejecuciones/[id]", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockCasoFindFirst.mockResolvedValueOnce(null);
    mockCasoCreate.mockResolvedValueOnce({
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-XXXXXX",
      nombre: "Consulta de saldo",
      script: "",
      scriptFileName: "x.spec.ts",
      responsableId: "user-1",
      origen: "grabador",
      activo: true,
    });
    mockParamUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockPasoUpdateMany.mockResolvedValueOnce({ count: 2 });
    mockSesionUpdate.mockResolvedValueOnce({});
    mockEjecucionCreate.mockResolvedValueOnce({ id: "ej-1" });

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1/guardar?ejecutar=true",
      { method: "POST" },
    );
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ejecucionId).toBe("ej-1");
    expect(data.redirectTo).toBe("/ejecuciones/ej-1");

    expect(mockEjecucionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          casoPruebaId: "caso-1",
          estado: "pendiente",
        }),
      }),
    );
  });

  it("without ?ejecutar, does NOT create an Ejecucion", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockCasoFindFirst.mockResolvedValueOnce(null);
    mockCasoCreate.mockResolvedValueOnce({
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-XXXXXX",
      nombre: "Consulta de saldo",
      script: "",
      scriptFileName: "x.spec.ts",
      responsableId: "user-1",
      origen: "grabador",
      activo: true,
    });
    mockParamUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockPasoUpdateMany.mockResolvedValueOnce({ count: 2 });
    mockSesionUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    expect(mockEjecucionCreate).not.toHaveBeenCalled();
  });

  it("uses 'Sin nombre' as fallback case name", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...baseSesion,
      nombre: "",
    });
    mockCasoFindFirst.mockResolvedValueOnce(null);
    mockCasoCreate.mockResolvedValueOnce({
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-XXXXXX",
      nombre: "Sin nombre",
      script: "",
      scriptFileName: "caso.spec.ts",
      responsableId: "user-1",
      origen: "grabador",
      activo: true,
    });
    mockParamUpdateMany.mockResolvedValueOnce({ count: 0 });
    mockPasoUpdateMany.mockResolvedValueOnce({ count: 2 });
    mockSesionUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", { method: "POST" });
    await POST(req, { params: Promise.resolve({ id: "ses-1" }) });

    expect(mockCasoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nombre: "Sin nombre" }),
      }),
    );
  });
});
