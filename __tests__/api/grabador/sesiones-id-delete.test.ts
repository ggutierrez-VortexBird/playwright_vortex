/**
 * Integration test: DELETE /api/grabador/sesiones/[id]
 *
 * Covers HU-G2 — Direct cascade delete (same effect as PATCH
 * estado='descartada' but without parsing body).
 *
 * The PasoGrabado FK has `onDelete: Cascade` at the Prisma schema level,
 * so deleting a SesionGrabacion automatically deletes its pasos. We assert
 * that the prisma call happens with the correct `where` and that auth
 * gates work (401 / 403 / 404).
 */

import { DELETE } from "@/app/api/grabador/sesiones/[id]/route";
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
const mockDelete = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      delete: (...args: unknown[]) => mockDelete(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DELETE /api/grabador/sesiones/[id]", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1",
      { method: "DELETE" },
    );
    const params = Promise.resolve({ id: "ses-1" });
    const res = await DELETE(req, { params });

    expect(res.status).toBe(401);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-x",
      { method: "DELETE" },
    );
    const params = Promise.resolve({ id: "ses-x" });
    const res = await DELETE(req, { params });

    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-2",
    });

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1",
      { method: "DELETE" },
    );
    const params = Promise.resolve({ id: "ses-1" });
    const res = await DELETE(req, { params });

    expect(res.status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes the session (and cascades pasos via FK) on happy path", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
    });
    mockDelete.mockResolvedValueOnce({});

    const req = new Request(
      "http://localhost/api/grabador/sesiones/ses-1",
      { method: "DELETE" },
    );
    const params = Promise.resolve({ id: "ses-1" });
    const res = await DELETE(req, { params });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ ok: true, deleted: true });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "ses-1" } });
    // Cascade on PasoGrabado.sesionId is at the schema level — we don't
    // call prisma.pasoGrabado.deleteMany here; the FK does it.
  });
});
