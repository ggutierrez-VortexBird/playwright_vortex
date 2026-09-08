/**
 * Integration test: GET /api/proyectos/[id]/credenciales
 *
 * - 401 sin sesión
 * - 200 con sesión; devuelve lista sin `valor`
 * - `vence` se mapea a ISO string o null
 */

import { GET } from "@/app/api/proyectos/[id]/credenciales/route";
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

const mockFindMany = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    credencial: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/proyectos/[id]/credenciales", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const req = new Request("http://localhost/api/proyectos/p1/credenciales", {
      method: "GET",
    });
    const params = Promise.resolve({ id: "p1" });
    const res = await GET(req, { params });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("No autenticado");
  });

  it("returns 200 with credenciales list (no `valor` field)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindMany.mockResolvedValue([
      {
        id: "c1",
        nombre: "Demo QA",
        tipo: "storageState",
        sesionVenceAt: new Date("2030-01-01T00:00:00Z"),
      },
      {
        id: "c2",
        nombre: "Prod QA",
        tipo: "userPass",
        sesionVenceAt: null,
      },
    ]);

    const req = new Request("http://localhost/api/proyectos/p1/credenciales", {
      method: "GET",
    });
    const params = Promise.resolve({ id: "p1" });
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data).toHaveLength(2);

    // Critical: NO debe incluir `valor`
    for (const item of data) {
      expect(item).not.toHaveProperty("valor");
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("nombre");
      expect(item).toHaveProperty("tipo");
      expect(item).toHaveProperty("vence");
    }

    expect(data[0].id).toBe("c1");
    expect(data[0].vence).toBe("2030-01-01T00:00:00.000Z");
    expect(data[1].vence).toBeNull();

    // Verifica que el query filtra por proyectoId
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { proyectoId: "p1" },
      select: expect.objectContaining({
        id: true,
        nombre: true,
        tipo: true,
        sesionVenceAt: true,
      }),
      orderBy: { nombre: "asc" },
    });
    // Y que el select EXCLUYE `valor`
    const selectArg = mockFindMany.mock.calls[0][0].select;
    expect(selectArg).not.toHaveProperty("valor");
  });

  it("returns 200 with empty array when no credenciales", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindMany.mockResolvedValue([]);

    const req = new Request("http://localhost/api/proyectos/p1/credenciales", {
      method: "GET",
    });
    const params = Promise.resolve({ id: "p1" });
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });
});