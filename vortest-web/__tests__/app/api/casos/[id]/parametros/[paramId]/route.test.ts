// __tests__/app/api/casos/[id]/parametros/[paramId]/route.test.ts
// Tests for PATCH /api/casos/[id]/parametros/[paramId] — update parameter default value.

import { PATCH } from "@/app/api/casos/[id]/parametros/[paramId]/route";
import { getSession, requireProyectoAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireProyectoAccess: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    casoPrueba: { findUnique: jest.fn() },
    parametroGrabacion: { findFirst: jest.fn(), update: jest.fn() },
    pasoGrabado: { findMany: jest.fn() },
  },
}));

describe("PATCH /api/casos/[id]/parametros/[paramId]", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna 401 cuando no hay sesion activa", async () => {
    (getSession as jest.Mock).mockResolvedValue({});
    const res = await PATCH({} as Request, {
      params: Promise.resolve({ id: "caso-1", paramId: "param-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("retorna 400 cuando el body no es JSON valido", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
    });
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
    const req = new Request("http://localhost", {
      method: "PATCH",
      body: "not-json",
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "caso-1", paramId: "param-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("retorna 400 cuando valorDefecto no es string ni null", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
    });
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valorDefecto: 123 }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "caso-1", paramId: "param-1" }),
    });
    expect(res.status).toBe(400);
  });

  it("retorna 404 cuando el caso no existe", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(null);
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valorDefecto: "nuevo-valor" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "inexistente", paramId: "param-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("retorna 403 cuando el usuario es de otro proyecto (IDOR)", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-other", rol: "tester" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-other",
    });
    (requireProyectoAccess as jest.Mock).mockRejectedValue(new Error("FORBIDDEN"));
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valorDefecto: "nuevo-valor" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "caso-1", paramId: "param-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("retorna 200 cuando la actualizacion es exitosa", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
    });
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
    (prisma.parametroGrabacion.findFirst as jest.Mock).mockResolvedValue({
      id: "param-1",
      origen: "variable",
    });
    (prisma.parametroGrabacion.update as jest.Mock).mockResolvedValue({
      id: "param-1",
      nombre: "username",
      valorDefecto: "nuevo-valor",
      origen: "variable",
      enUso: false,
    });
    (prisma.pasoGrabado.findMany as jest.Mock).mockResolvedValue([]);
    const req = new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valorDefecto: "nuevo-valor" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "caso-1", paramId: "param-1" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.parametro.valorDefecto).toBe("nuevo-valor");
  });
});
