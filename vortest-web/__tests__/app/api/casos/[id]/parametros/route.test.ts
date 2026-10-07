// __tests__/app/api/casos/[id]/parametros/route.test.ts
// Tests for GET /api/casos/[id]/parametros — parameter listing with enUso flag.

import { GET } from "@/app/api/casos/[id]/parametros/route";
import { getSession, requireProyectoAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireProyectoAccess: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    casoPrueba: { findUnique: jest.fn() },
    parametroGrabacion: { findMany: jest.fn() },
    pasoGrabado: { findMany: jest.fn() },
  },
}));

describe("GET /api/casos/[id]/parametros", () => {
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

    const res = await GET({} as Request, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(403);
  });

  it("retorna 200 con la lista de parametros", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
    });
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
    (prisma.parametroGrabacion.findMany as jest.Mock).mockResolvedValue([
      { id: "param-1", nombre: "username", valorDefecto: "admin", origen: "variable" },
    ]);
    (prisma.pasoGrabado.findMany as jest.Mock).mockResolvedValue([
      { descripcion: "Login with {{username}}", valor: "admin" },
    ]);

    const res = await GET({} as Request, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.parametros).toHaveLength(1);
    expect(data.parametros[0].nombre).toBe("username");
    expect(data.parametros[0].enUso).toBe(true);
  });
});
