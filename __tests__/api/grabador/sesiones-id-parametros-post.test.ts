/**
 * Tests for POST /api/grabador/sesiones/[id]/parametros (HU-G7).
 */

import { POST } from "@/app/api/grabador/sesiones/[id]/parametros/route";
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
const mockCreate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    parametroGrabacion: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/grabador/sesiones/[id]/parametros", () => {
  const baseSesion = { id: "ses-1", usuarioId: "user-1" };

  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({ nombre: "usuario" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when JSON is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/...", {
      method: "POST",
      body: "{bad",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when nombre is missing or invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });

    // Missing
    let req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({}),
    });
    let res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);

    // Invalid characters
    req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({ nombre: "1starts-with-digit" }),
    });
    res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);

    // Too long
    req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({ nombre: "a".repeat(51) }),
    });
    res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when origen is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({ nombre: "x", origen: "BAD" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({ nombre: "usuario" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ id: "ses-1", usuarioId: "user-2" });
    const req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({ nombre: "usuario" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(403);
  });

  it("creates a parametro with default origen=manual", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockCreate.mockResolvedValueOnce({
      id: "param-1",
      sesionId: "ses-1",
      casoPruebaId: null,
      nombre: "usuario",
      valorDefecto: "admin",
      origen: "manual",
      credencialId: null,
      enUso: true,
    });

    const req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({
        nombre: "usuario",
        valorDefecto: "admin",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.parametro.id).toBe("param-1");
    expect(data.parametro.nombre).toBe("usuario");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sesionId: "ses-1",
          nombre: "usuario",
          valorDefecto: "admin",
          origen: "manual",
        }),
      }),
    );
  });

  it("creates a parametro with origen=credencial and credencialId", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockCreate.mockResolvedValueOnce({
      id: "param-2",
      sesionId: "ses-1",
      casoPruebaId: null,
      nombre: "pwd",
      valorDefecto: null,
      origen: "credencial",
      credencialId: "cred-1",
      enUso: true,
    });

    const req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({
        nombre: "pwd",
        origen: "credencial",
        credencialId: "cred-1",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.parametro.origen).toBe("credencial");
    expect(data.parametro.credencialId).toBe("cred-1");
  });

  it("returns 409 on duplicate (sesionId, nombre) P2002", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockCreate.mockRejectedValueOnce({ code: "P2002" });

    const req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({ nombre: "usuario" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(409);
  });

  it("accepts snake_case names with underscores", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockCreate.mockResolvedValueOnce({
      id: "param-3",
      sesionId: "ses-1",
      casoPruebaId: null,
      nombre: "saldo_esperado",
      valorDefecto: "1500",
      origen: "manual",
      credencialId: null,
      enUso: true,
    });

    const req = new Request("http://localhost/...", {
      method: "POST",
      body: JSON.stringify({ nombre: "saldo_esperado", valorDefecto: "1500" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.parametro.nombre).toBe("saldo_esperado");
  });
});
