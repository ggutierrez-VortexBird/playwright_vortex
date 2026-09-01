/**
 * Tests for pause/resume endpoints (HU-G7).
 */

import { POST as pausePOST } from "@/app/api/grabador/sesiones/[id]/pause/route";
import { POST as resumePOST } from "@/app/api/grabador/sesiones/[id]/resume/route";
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
const mockPasoFindFirst = jest.fn();
const mockPasoCreate = jest.fn();

const mockTx = {
  pasoGrabado: {
    findFirst: (...args: unknown[]) => mockPasoFindFirst(...args),
    create: (...args: unknown[]) => mockPasoCreate(...args),
  },
  sesionGrabacion: {
    update: (...args: unknown[]) => mockUpdate(...args),
  },
};

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    pasoGrabado: {
      findFirst: (...args: unknown[]) => mockPasoFindFirst(...args),
      create: (...args: unknown[]) => mockPasoCreate(...args),
    },
    $transaction: (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/grabador/sesiones/[id]/pause", () => {
  const baseSesion = { id: "ses-1", usuarioId: "user-1", estado: "activa" };

  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await pausePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await pausePOST(req, { params: Promise.resolve({ id: "ses-x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ ...baseSesion, usuarioId: "user-2" });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await pausePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when session is not active", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ ...baseSesion, estado: "detenida" });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await pausePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("session_not_active");
  });

  it("persists estado='pausada' and writes PAUSE_AT marker", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(baseSesion);
    mockUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await pausePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.estado).toBe("pausada");

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updateData = mockUpdate.mock.calls[0][0].data;
    expect(updateData.estado).toBe("pausada");
    expect(updateData.mensajeError).toMatch(/^PAUSE_AT:\d+$/);
  });

  it("is idempotent — pausing an already-paused session returns 200 with alreadyPaused=true", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...baseSesion,
      estado: "pausada",
    });

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await pausePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alreadyPaused).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("POST /api/grabador/sesiones/[id]/resume", () => {
  const baseSesion = {
    id: "ses-1",
    usuarioId: "user-1",
    estado: "pausada",
    mensajeError: "PAUSE_AT:1",
  };

  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await resumePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await resumePOST(req, { params: Promise.resolve({ id: "ses-x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ ...baseSesion, usuarioId: "user-2" });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await resumePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 400 when session is not paused", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ ...baseSesion, estado: "activa" });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await resumePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("resumes without creating auto-wait step when pause was short (<5s)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...baseSesion,
      mensajeError: `PAUSE_AT:${Date.now() - 1000}`, // 1s ago
    });
    mockUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await resumePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.estado).toBe("activa");
    expect(data.autoEsperaCreada).toBe(false);
    expect(mockPasoCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ses-1" },
        data: expect.objectContaining({
          estado: "activa",
          mensajeError: null,
        }),
      }),
    );
  });

  it("creates an auto Esperar «pausa» step when pause was >5s", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...baseSesion,
      mensajeError: `PAUSE_AT:${Date.now() - 8000}`, // 8s ago
    });
    mockPasoFindFirst.mockResolvedValueOnce({ numero: 3 });
    mockPasoCreate.mockResolvedValueOnce({ id: "paso-w", numero: 4 });
    mockUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await resumePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.autoEsperaCreada).toBe(true);

    expect(mockPasoCreate).toHaveBeenCalledTimes(1);
    const createArgs = mockPasoCreate.mock.calls[0][0];
    expect(createArgs.data.tipo).toBe("esperar");
    expect(createArgs.data.origen).toBe("auto");
    expect(createArgs.data.descripcion).toMatch(/^Esperar «pausa» \d+\.\d+s$/);
    expect(createArgs.data.numero).toBe(4);
  });

  it("resumes gracefully when mensajeError is not a PAUSE_AT marker (legacy data)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...baseSesion,
      mensajeError: "some-old-error-msg",
    });
    mockUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await resumePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.autoEsperaCreada).toBe(false);
    expect(mockPasoCreate).not.toHaveBeenCalled();
  });

  it("resumes gracefully when mensajeError is null", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      ...baseSesion,
      mensajeError: null,
    });
    mockUpdate.mockResolvedValueOnce({});

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await resumePOST(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.autoEsperaCreada).toBe(false);
  });
});
