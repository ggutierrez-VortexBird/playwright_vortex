// __tests__/app/api/proyectos/[id]/credenciales/route.test.ts
// Tests for GET /api/proyectos/[id]/credenciales — superadmin-only credential listing.

import { GET } from "@/app/api/proyectos/[id]/credenciales/route";
import { getSession, requireSuperadmin, FORBIDDEN_ERROR } from "@/lib/auth";
import { prisma } from "@/lib/db";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireSuperadmin: jest.fn(),
  FORBIDDEN_ERROR: new Error("FORBIDDEN"),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    credencial: { findMany: jest.fn() },
  },
}));

describe("GET /api/proyectos/[id]/credenciales", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 cuando no hay sesion activa", async () => {
    (getSession as jest.Mock).mockResolvedValue({});
    const res = await GET({} as Request, { params: Promise.resolve({ id: "proyecto-1" }) });
    expect(res.status).toBe(401);
  });

  it("retorna 403 cuando el usuario no es superadmin (IDOR)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-not-admin", rol: "tester" });
    (requireSuperadmin as jest.Mock).mockImplementation(() => {
      throw FORBIDDEN_ERROR;
    });

    const res = await GET({} as Request, { params: Promise.resolve({ id: "proyecto-1" }) });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("Sin permisos");
  });

  it("retorna 200 con la lista de credenciales del proyecto", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "admin-1", rol: "superadmin" });
    (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
    (prisma.credencial.findMany as jest.Mock).mockResolvedValue([
      {
        id: "cred-1",
        nombre: "API_KEY",
        tipo: "api_key",
        sesionVenceAt: null,
      },
      {
        id: "cred-2",
        nombre: "SESSION_TOKEN",
        tipo: "session",
        sesionVenceAt: new Date("2026-12-31"),
      },
    ]);

    const res = await GET({} as Request, { params: Promise.resolve({ id: "proyecto-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data[0].nombre).toBe("API_KEY");
    expect(data[0]).not.toHaveProperty("valor");
    expect(data[1].vence).toBeDefined();
  });
});
