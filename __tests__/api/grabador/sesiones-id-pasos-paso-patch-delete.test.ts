/**
 * Tests for PATCH/DELETE /api/grabador/sesiones/[id]/pasos/[pasoId] (HU-G9).
 */

import { PATCH, DELETE } from "@/app/api/grabador/sesiones/[id]/pasos/[pasoId]/route";
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
const mockPasoUpdate = jest.fn();
const mockPasoDelete = jest.fn();
const mockPasoFindMany = jest.fn();
const mockParamFindMany = jest.fn();
const mockParamUpdate = jest.fn();

const mockTx = {
  pasoGrabado: {
    update: (...args: unknown[]) => mockPasoUpdate(...args),
    delete: (...args: unknown[]) => mockPasoDelete(...args),
    findMany: (...args: unknown[]) => mockPasoFindMany(...args),
  },
  parametroGrabacion: {
    findMany: (...args: unknown[]) => mockParamFindMany(...args),
    update: (...args: unknown[]) => mockParamUpdate(...args),
  },
};

jest.mock("@/lib/db", () => ({
  prisma: {
    pasoGrabado: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    $transaction: async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PATCH /api/grabador/sesiones/[id]/pasos/[pasoId]", () => {
  const basePaso = {
    id: "paso-1",
    sesionId: "ses-1",
    descripcion: "Click en «Submit»",
    valor: null,
    sesion: { usuarioId: "user-1" },
  };

  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ descripcion: "x" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when paso doesn't exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ descripcion: "x" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-x" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when paso belongs to a different session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ ...basePaso, sesionId: "ses-OTHER" });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ descripcion: "x" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when sesion belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...basePaso,
      sesion: { usuarioId: "user-2" },
    });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ descripcion: "x" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when descripcion is empty (after trim)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(basePaso);
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ descripcion: "   " }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("updates descripcion and returns the updated paso", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(basePaso);
    mockPasoUpdate.mockResolvedValueOnce({
      ...basePaso,
      descripcion: "Click en «Go»",
    });

    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ descripcion: "Click en «Go»" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.paso.descripcion).toBe("Click en «Go»");
    expect(mockPasoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "paso-1" },
        data: { descripcion: "Click en «Go»" },
      }),
    );
  });

  it("updates selectorPrincipal with JSON payload", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(basePaso);
    mockPasoUpdate.mockResolvedValueOnce(basePaso);

    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({
        selectorPrincipal: { tag: "button", testId: "go" },
      }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPasoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          selectorPrincipal: { tag: "button", testId: "go" },
        }),
      }),
    );
  });

  it("nullifies selectorPrincipal when passed as null (sends Prisma.JsonNull)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(basePaso);
    mockPasoUpdate.mockResolvedValueOnce(basePaso);

    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ selectorPrincipal: null }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(200);
    const updateArgs = mockPasoUpdate.mock.calls[0][0];
    // The handler should send Prisma.JsonNull (a marker object) so Prisma
    // writes SQL NULL instead of an empty object.
    const sentinel = updateArgs.data.selectorPrincipal;
    expect(sentinel).not.toBeNull();
    expect(typeof sentinel).toBe("object");
  });

  it("updates valor", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(basePaso);
    mockPasoUpdate.mockResolvedValueOnce(basePaso);

    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ valor: "new-value" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPasoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ valor: "new-value" }),
      }),
    );
  });

  it("updates linked parametro default when actualizarDefaultParametro=true and descripcion contains {{nombre}}", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...basePaso,
      descripcion: "Escribir {{usuario}} en «Username»",
      valor: "{{usuario}}",
    });
    mockPasoUpdate.mockResolvedValueOnce(basePaso);
    mockParamFindMany.mockResolvedValueOnce([
      { id: "param-1", nombre: "usuario" },
    ]);
    mockParamUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({
        valor: "newadmin",
        actualizarDefaultParametro: true,
      }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockParamUpdate).toHaveBeenCalledTimes(1);
    expect(mockParamUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "param-1" },
        data: { valorDefecto: "newadmin" },
      }),
    );
  });

  it("does NOT update any parametro when no {{nombre}} match", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...basePaso,
      descripcion: "Click",
      valor: null,
    });
    mockPasoUpdate.mockResolvedValueOnce(basePaso);
    mockParamFindMany.mockResolvedValueOnce([
      { id: "param-1", nombre: "usuario" },
    ]);

    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({
        valor: "x",
        actualizarDefaultParametro: true,
      }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockParamUpdate).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/grabador/sesiones/[id]/pasos/[pasoId]", () => {
  const basePaso = {
    id: "paso-1",
    sesionId: "ses-1",
    numero: 3,
    sesion: { usuarioId: "user-1" },
  };

  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when paso doesn't exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-x" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when sesion belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...basePaso,
      sesion: { usuarioId: "user-2" },
    });
    const req = new Request("http://localhost/...", { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("deletes the paso and renumbers subsequent pasos", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(basePaso);
    mockPasoDelete.mockResolvedValueOnce({ id: "paso-1" });
    mockPasoFindMany.mockResolvedValueOnce([
      { id: "paso-2", numero: 4 },
      { id: "paso-3", numero: 5 },
    ]);
    mockPasoUpdate
      .mockResolvedValueOnce({ id: "paso-2", numero: 3 })
      .mockResolvedValueOnce({ id: "paso-3", numero: 4 });

    const req = new Request("http://localhost/...", { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe("paso-1");

    expect(mockPasoDelete).toHaveBeenCalledWith({ where: { id: "paso-1" } });
    expect(mockPasoUpdate).toHaveBeenCalledTimes(2);
    expect(mockPasoUpdate.mock.calls[0][0].data.numero).toBe(3); // was 4 → 3
    expect(mockPasoUpdate.mock.calls[1][0].data.numero).toBe(4); // was 5 → 4
  });

  it("deletes the last paso without renumbering anything", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(basePaso);
    mockPasoDelete.mockResolvedValueOnce({ id: "paso-1" });
    mockPasoFindMany.mockResolvedValueOnce([]);

    const req = new Request("http://localhost/...", { method: "DELETE" });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "ses-1", pasoId: "paso-1" }),
    });
    expect(res.status).toBe(200);
    expect(mockPasoUpdate).not.toHaveBeenCalled();
  });
});
