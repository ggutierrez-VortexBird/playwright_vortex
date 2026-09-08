/**
 * Integration test: PATCH /api/grabador/sesiones/[id]
 *
 * Covers HU-G2 — Detener (estado='detenida') and Descartar
 * (estado='descartada' → cascade delete) from the topbar buttons.
 *
 * Cases:
 *   - 401 sin sesión
 *   - 400 JSON inválido o estado inválido
 *   - 403 sesión de otro usuario
 *   - 404 sesión inexistente
 *   - 200 PATCH estado='detenida' → marca endedAt
 *   - 200 PATCH estado='descartada' → cascade delete
 *   - 200 idempotente: si ya está detenida/descartada, no hace nada
 */

import { PATCH } from "@/app/api/grabador/sesiones/[id]/route";
import { getSession } from "@/lib/auth";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: ResponseInit) =>
      new Response(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      }),
  },
}));

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getSession: jest.fn(),
}));

const mockFindUnique = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PATCH /api/grabador/sesiones/[id]", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "detenida" }),
    });
    const params = Promise.resolve({ id: "ses-1" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(401);
  });

  it("returns 400 when JSON is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1", {
      method: "PATCH",
      body: "{bad json",
    });
    const params = Promise.resolve({ id: "ses-1" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("validation");
  });

  it("returns 400 when estado is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "pausada" }),
    });
    const params = Promise.resolve({ id: "ses-1" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.message).toContain("estado debe ser uno de");
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/grabador/sesiones/ses-x", {
      method: "PATCH",
      body: JSON.stringify({ estado: "detenida" }),
    });
    const params = Promise.resolve({ id: "ses-x" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(404);
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-2",
      estado: "activa",
    });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "detenida" }),
    });
    const params = Promise.resolve({ id: "ses-1" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("PATCH estado='detenida' marks endedAt and updates DB", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "activa",
    });
    mockUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "detenida" }),
    });
    const params = Promise.resolve({ id: "ses-1" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdate.mock.calls[0][0];
    expect(updateArgs.where.id).toBe("ses-1");
    expect(updateArgs.data.estado).toBe("detenida");
    expect(updateArgs.data.endedAt).toBeInstanceOf(Date);
  });

  it("PATCH estado='descartada' cascade-deletes the session (and its pasos via FK)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "activa",
    });
    mockDelete.mockResolvedValueOnce({});

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "descartada" }),
    });
    const params = Promise.resolve({ id: "ses-1" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, deleted: true });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ses-1" } });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("PATCH estado='detenida' is idempotent when session is already 'detenida'", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "detenida",
    });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "detenida" }),
    });
    const params = Promise.resolve({ id: "ses-1" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, alreadyTerminal: true });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("PATCH estado='detenida' is idempotent when session is already 'descartada'", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "descartada",
    });

    const req = new Request("http://localhost/api/grabador/sesiones/ses-1", {
      method: "PATCH",
      body: JSON.stringify({ estado: "detenida" }),
    });
    const params = Promise.resolve({ id: "ses-1" });
    const res = await PATCH(req, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alreadyTerminal).toBe(true);
  });
});
