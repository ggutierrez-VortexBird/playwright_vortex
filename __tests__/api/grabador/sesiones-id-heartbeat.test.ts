/**
 * Integration test: POST /api/grabador/sesiones/[id]/heartbeat
 *
 * Covers HU-G2 — heartbeat HTTP fallback so the browser can keep the
 * session alive even when the WS is down.
 *
 * Cases:
 *   - 401 sin sesión
 *   - 200 happy path → {ok: true, ttl: 600}
 *   - 404 sesión inexistente
 *   - 403 sesión de otro usuario
 *   - 409 sesión no activa (estado != 'activa')
 *   - Persiste updatedAt (refresca el timestamp para cleanupOrphans)
 */

import { POST } from "@/app/api/grabador/sesiones/[id]/heartbeat/route";
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

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/grabador/sesiones/[id]/heartbeat", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1/heartbeat",
      { method: "POST" },
    );
    const params = Promise.resolve({ id: "ses-1" });
    const res = await POST(req, { params });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("No autenticado");
  });

  it("returns 200 with ttl on happy path and refreshes updatedAt", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "activa",
      updatedAt: new Date(Date.now() - 60_000),
    });
    mockUpdate.mockResolvedValueOnce({});

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1/heartbeat",
      { method: "POST" },
    );
    const params = Promise.resolve({ id: "ses-1" });
    const res = await POST(req, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, ttl: 600 });

    // UpdatedAt is refreshed (Date object = "now")
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateArgs = mockUpdate.mock.calls[0][0];
    expect(updateArgs.where.id).toBe("ses-1");
    expect(updateArgs.data.updatedAt).toBeInstanceOf(Date);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-missing/heartbeat",
      { method: "POST" },
    );
    const params = Promise.resolve({ id: "ses-missing" });
    const res = await POST(req, { params });

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("not_found");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-2",
      estado: "activa",
      updatedAt: new Date(),
    });

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1/heartbeat",
      { method: "POST" },
    );
    const params = Promise.resolve({ id: "ses-1" });
    const res = await POST(req, { params });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("forbidden");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 409 when session is not in 'activa' state", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "detenida",
      updatedAt: new Date(),
    });

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1/heartbeat",
      { method: "POST" },
    );
    const params = Promise.resolve({ id: "ses-1" });
    const res = await POST(req, { params });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("session_not_active");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("treats 'iniciando' as not-active (heartbeat only valid for 'activa')", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "iniciando",
      updatedAt: new Date(),
    });

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1/heartbeat",
      { method: "POST" },
    );
    const params = Promise.resolve({ id: "ses-1" });
    const res = await POST(req, { params });

    expect(res.status).toBe(409);
  });
});
