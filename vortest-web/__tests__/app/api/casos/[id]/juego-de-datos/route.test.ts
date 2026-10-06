// __tests__/app/api/casos/[id]/juego-de-datos/route.test.ts
// Tests for GET/POST /api/casos/[id]/juego-de-datos — data-driven test data.

import { GET, POST } from "@/app/api/casos/[id]/juego-de-datos/route";
import { getSession, requireProyectoAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireProyectoAccess: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    casoPrueba: { findUnique: jest.fn() },
    juegoDeDatos: { findMany: jest.fn(), deleteMany: jest.fn(), create: jest.fn() },
    parametroGrabacion: { findMany: jest.fn() },
  },
}));

describe("GET /api/casos/[id]/juego-de-datos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 cuando no hay sesion activa", async () => {
    (getSession as jest.Mock).mockResolvedValue({});
    const res = await GET({} as Request, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(401);
  });

  it("retorna 404 cuando el caso no existe", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(null);
    const res = await GET({} as Request, { params: Promise.resolve({ id: "inexistente" }) });
    expect(res.status).toBe(404);
  });

  it("retorna 403 cuando el usuario es de otro proyecto (IDOR)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-other", rol: "tester" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-other",
    });
    (requireProyectoAccess as jest.Mock).mockRejectedValue(new Error("FORBIDDEN"));

    await expect(GET({} as Request, { params: Promise.resolve({ id: "caso-1" }) }))
      .rejects.toThrow("FORBIDDEN");
  });

  it("retorna 200 con la lista de juegos de datos", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
    });
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
    (prisma.juegoDeDatos.findMany as jest.Mock).mockResolvedValue([
      { id: "juego-1", nombreArchivo: "datos.csv", filas: [], createdAt: new Date() },
    ]);

    const res = await GET({} as Request, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.juegos).toHaveLength(1);
    expect(data.juegos[0].nombreArchivo).toBe("datos.csv");
  });
});
