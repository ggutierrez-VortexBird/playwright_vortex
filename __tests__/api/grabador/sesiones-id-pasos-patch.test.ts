/**
 * Tests for PATCH /api/grabador/sesiones/[id]/pasos — reorder (HU-G8).
 */

import { PATCH } from "@/app/api/grabador/sesiones/[id]/pasos/route";
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
const mockFindMany = jest.fn();

const mockTx = {
  pasoGrabado: {
    update: (...args: unknown[]) => mockUpdate(...args),
    findMany: (...args: unknown[]) => mockFindMany(...args),
  },
};

jest.mock("@/lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    pasoGrabado: {
      update: (...args: unknown[]) => mockUpdate(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    $transaction: async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PATCH /api/grabador/sesiones/[id]/pasos (reorder)", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: ["p1"] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 400 when JSON is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: "{bad",
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when orderedIds is missing or empty", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: [] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 when orderedIds contains non-string entries", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: ["p1", 42, "p3"] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 when session does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: ["p1"] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 when session belongs to a different user", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-2",
      pasos: [],
    });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: ["p1"] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(403);
  });

  it("returns 409 when orderedIds doesn't match the existing pasos", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      pasos: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    });
    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: ["p1", "p2"] }), // missing p3
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(409);
  });

  it("renumbers pasos via two-phase update (negative first, then 1..N)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      pasos: [{ id: "p1" }, { id: "p2" }, { id: "p3" }],
    });
    mockUpdate.mockResolvedValue({});
    mockFindMany.mockResolvedValueOnce([
      { id: "p3", numero: 1, sesionId: "ses-1" },
      { id: "p1", numero: 2, sesionId: "ses-1" },
      { id: "p2", numero: 3, sesionId: "ses-1" },
    ]);

    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: ["p3", "p1", "p2"] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.pasos.map((p: { id: string }) => p.id)).toEqual([
      "p3",
      "p1",
      "p2",
    ]);

    // Phase 1: 3 negative assignments.
    expect(mockUpdate.mock.calls[0][0]).toEqual({
      where: { id: "p3" },
      data: { numero: -1 },
    });
    expect(mockUpdate.mock.calls[1][0]).toEqual({
      where: { id: "p1" },
      data: { numero: -2 },
    });
    expect(mockUpdate.mock.calls[2][0]).toEqual({
      where: { id: "p2" },
      data: { numero: -3 },
    });
    // Phase 2: 3 positive sequential assignments.
    expect(mockUpdate.mock.calls[3][0]).toEqual({
      where: { id: "p3" },
      data: { numero: 1 },
    });
    expect(mockUpdate.mock.calls[4][0]).toEqual({
      where: { id: "p1" },
      data: { numero: 2 },
    });
    expect(mockUpdate.mock.calls[5][0]).toEqual({
      where: { id: "p2" },
      data: { numero: 3 },
    });
    expect(mockUpdate).toHaveBeenCalledTimes(6);
  });

  it("handles a single paso (no-op renumber)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({
      id: "ses-1",
      usuarioId: "user-1",
      pasos: [{ id: "p1" }],
    });
    mockUpdate.mockResolvedValue({});
    mockFindMany.mockResolvedValueOnce([{ id: "p1", numero: 1, sesionId: "ses-1" }]);

    const req = new Request("http://localhost/...", {
      method: "PATCH",
      body: JSON.stringify({ orderedIds: ["p1"] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "ses-1" }) });
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
  });
});
