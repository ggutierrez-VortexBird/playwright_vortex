/**
 * Tests for POST /api/casos/[id]/ejecutar (HU-G16 redirect target stub).
 */

import { POST } from "@/app/api/casos/[id]/ejecutar/route";
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
    casoPrueba: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    ejecucion: {
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /api/casos/[id]/ejecutar", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when caso does not exist", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "caso-x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 409 when caso is inactive", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ id: "caso-1", activo: false });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(409);
  });

  it("creates an Ejecucion in 'pendiente' state and returns the redirect", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ id: "caso-1", activo: true });
    mockCreate.mockResolvedValueOnce({
      id: "ej-1",
      casoPruebaId: "caso-1",
      estado: "pendiente",
    });

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ejecucionId).toBe("ej-1");
    expect(data.redirectTo).toBe("/ejecuciones/ej-1");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          casoPruebaId: "caso-1",
          estado: "pendiente",
        }),
      }),
    );
  });
});
