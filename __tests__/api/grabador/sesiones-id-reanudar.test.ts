// __tests__/api/grabador/sesiones-id-reanudar.test.ts
// HU-GR-2 — tests para POST /api/grabador/sesiones/[id]/reanudar
//
// El recorder-worker (en memoria) conserva el BrowserContext tras un
// stop (ver lib/recorder/ws-server.ts case 'stop'). El endpoint de
// reanudar solo cambia el estado en DB; el cliente al recibir 200 navega
// a /casos/grabar/[id] y rehidrata el token; si el worker sigue vivo,
// el WS reconecta al BrowserContext preservado.

import { POST } from "@/app/api/grabador/sesiones/[id]/reanudar/route";
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

describe("POST /api/grabador/sesiones/[id]/reanudar (HU-GR-2)", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, {
      params: Promise.resolve({ id: "ses-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, {
      params: Promise.resolve({ id: "ses-x" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-2",
      estado: "detenida",
      mensajeError: null,
    });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, {
      params: Promise.resolve({ id: "ses-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 when session is in 'guardada' (no se puede reanudar)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "guardada",
      mensajeError: null,
    });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, {
      params: Promise.resolve({ id: "ses-1" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("cannot_resume");
  });

  it("sets estado='activa' and clears endedAt/mensajeError (HU-GR-2 contract)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "detenida",
      mensajeError: "user stop",
    });
    mockUpdate.mockResolvedValueOnce({});
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, {
      params: Promise.resolve({ id: "ses-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe("activa");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ses-1" },
        data: expect.objectContaining({
          estado: "activa",
          endedAt: null,
          mensajeError: null,
        }),
      }),
    );
  });

  it("también reanuda desde 'pausada' (toggle pausa)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      estado: "pausada",
      mensajeError: null,
    });
    mockUpdate.mockResolvedValueOnce({});
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, {
      params: Promise.resolve({ id: "ses-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.estado).toBe("activa");
  });
});