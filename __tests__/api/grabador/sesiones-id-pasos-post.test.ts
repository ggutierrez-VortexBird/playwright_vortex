/**
 * Tests for POST /api/grabador/sesiones/[id]/pasos.
 *
 * HU-G6 + HU-G10: crear pasos manuales (verificación / clic / esperar / etc).
 */

import { POST } from "@/app/api/grabador/sesiones/[id]/pasos/route";
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
}));

const mockFindUnique = jest.fn();
const mockPasoCreate = jest.fn();
const mockPasoFindFirst = jest.fn();
const mockPasoCount = jest.fn();
const mockPasoFindMany = jest.fn();
const mockPasoUpdate = jest.fn();

const mockTx = {
  pasoGrabado: {
    create: (...args: unknown[]) => mockPasoCreate(...args),
    findFirst: (...args: unknown[]) => mockPasoFindFirst(...args),
    count: (...args: unknown[]) => mockPasoCount(...args),
    findMany: (...args: unknown[]) => mockPasoFindMany(...args),
    update: (...args: unknown[]) => mockPasoUpdate(...args),
  },
};

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    pasoGrabado: {
      create: (...args: unknown[]) => mockPasoCreate(...args),
      findFirst: (...args: unknown[]) => mockPasoFindFirst(...args),
      count: (...args: unknown[]) => mockPasoCount(...args),
      findMany: (...args: unknown[]) => mockPasoFindMany(...args),
      update: (...args: unknown[]) => mockPasoUpdate(...args),
    },
    $transaction: (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/grabador/sesiones/[id]/pasos", () => {
  const baseSesion = { id: "ses-1", usuarioId: "user-1" };

  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({ tipo: "verificar", descripcion: "X" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when JSON is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: "{bad",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when tipo is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({ tipo: "BAD", descripcion: "x" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("tipo debe ser uno de");
  });

  it("returns 400 when origen is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({
        tipo: "verificar",
        origen: "INVALID",
        descripcion: "x",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when descripcion is empty", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({ tipo: "verificar", descripcion: "  " }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when assertionKind is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({
        tipo: "verificar",
        descripcion: "x",
        assertionKind: "WEIRD",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/grabador/sesiones/ses-x/pasos", {
      method: "POST",
      body: JSON.stringify({ tipo: "verificar", descripcion: "x" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ id: "ses-1", usuarioId: "user-2" });
    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({ tipo: "verificar", descripcion: "x" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(403);
  });

  it("creates a verificacion paso with next available numero when numero is omitted", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockPasoFindFirst.mockResolvedValueOnce({ numero: 5 });
    mockPasoCreate.mockResolvedValueOnce({
      id: "paso-6",
      sesionId: "ses-1",
      numero: 6,
      tipo: "verificar",
      origen: "manual",
      descripcion: "Verificar que «Submit» está visible",
      selectorPrincipal: null,
      selectoresRespaldo: null,
      valor: null,
      esValorSensible: false,
      assertionKind: "visible",
    });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({
        tipo: "verificar",
        origen: "manual",
        descripcion: "Verificar que «Submit» está visible",
        assertionKind: "visible",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.paso.id).toBe("paso-6");
    expect(data.paso.numero).toBe(6);
    expect(data.paso.tipo).toBe("verificar");
    expect(data.paso.assertionKind).toBe("visible");
  });

  it("creates with numero=1 when there are no existing pasos", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockPasoFindFirst.mockResolvedValueOnce(null);
    mockPasoCreate.mockResolvedValueOnce({
      id: "paso-1",
      sesionId: "ses-1",
      numero: 1,
      tipo: "verificar",
      origen: "manual",
      descripcion: "x",
      selectorPrincipal: null,
      selectoresRespaldo: null,
      valor: null,
      esValorSensible: false,
      assertionKind: null,
    });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({
        tipo: "verificar",
        origen: "manual",
        descripcion: "x",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.paso.numero).toBe(1);
  });

  it("uses caller-provided numero when no collision (inserts at end)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockPasoCount.mockResolvedValueOnce(0);
    mockPasoCreate.mockResolvedValueOnce({
      id: "paso-new",
      sesionId: "ses-1",
      numero: 10,
      tipo: "clic",
      origen: "manual",
      descripcion: "x",
      selectorPrincipal: null,
      selectoresRespaldo: null,
      valor: null,
      esValorSensible: false,
      assertionKind: null,
    });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({
        tipo: "clic",
        origen: "manual",
        descripcion: "x",
        numero: 10,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(201);
    expect((await res.json()).paso.numero).toBe(10);
    expect(mockPasoUpdate).not.toHaveBeenCalled();
  });

  it("shifts subsequent pasos when caller-provided numero collides (insert in the middle)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockPasoCount.mockResolvedValueOnce(1); // there's already a paso at numero=3
    // findMany for desplaz: returns existing paso 3 (new) and 4 (existing)
    mockPasoFindMany.mockResolvedValueOnce([
      { id: "paso-existing-4", numero: 4 },
      { id: "paso-existing-3", numero: 3 },
    ]);
    mockPasoUpdate
      .mockResolvedValueOnce({ id: "paso-existing-4", numero: 5 })
      .mockResolvedValueOnce({ id: "paso-existing-3", numero: 4 });
    mockPasoCreate.mockResolvedValueOnce({
      id: "paso-new",
      sesionId: "ses-1",
      numero: 3,
      tipo: "clic",
      origen: "manual",
      descripcion: "Inserted in the middle",
      selectorPrincipal: null,
      selectoresRespaldo: null,
      valor: null,
      esValorSensible: false,
      assertionKind: null,
    });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({
        tipo: "clic",
        origen: "manual",
        descripcion: "Inserted in the middle",
        numero: 3,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(201);
    expect((await res.json()).paso.numero).toBe(3);
    // Both existing pasos got shifted.
    expect(mockPasoUpdate).toHaveBeenCalledTimes(2);
    expect(mockPasoUpdate.mock.calls[0][0].data.numero).toBe(5);
    expect(mockPasoUpdate.mock.calls[1][0].data.numero).toBe(4);
  });

  it("returns 400 when caller-provided numero is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({
        tipo: "clic",
        origen: "manual",
        descripcion: "x",
        numero: 0,
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 409 on P2002 unique constraint", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockPasoFindFirst.mockResolvedValueOnce({ numero: 0 });
    mockPasoCreate.mockRejectedValueOnce({ code: "P2002" });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1/pasos", {
      method: "POST",
      body: JSON.stringify({
        tipo: "verificar",
        origen: "manual",
        descripcion: "x",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(409);
  });
});
