/**
 * Tests for POST /api/casos/[id]/ejecutar (HU-G16 redirect target stub).
 *
 * Motor Fase 1: esta ruta ya no crea su propia Ejecucion a mano — delega en
 * `dispararEjecucion` (lib/ejecuciones/actions.ts), la misma Server Action
 * que usa el resto de la app (guard anti-concurrencia + despacho a
 * RabbitMQ). Estos tests mockean `dispararEjecucion` directamente: lo que
 * le compete verificar A ESTA ruta es su propio guard de auth/activo y el
 * mapeo de la respuesta/errores, no la lógica interna de dispararEjecucion
 * (que tiene su propia suite en __tests__/lib/ejecuciones/actions.test.ts).
 */

import { POST } from "@/app/api/casos/[id]/ejecutar/route";
import { getSession } from "@/lib/auth";
import { dispararEjecucion } from "@/lib/ejecuciones/actions";
import { YA_EXISTE_EJECUCION_EN_CURSO_ERROR } from "@/lib/ejecuciones/errors";

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
  getUsuarioActual: jest.fn().mockResolvedValue({ id: "user-1", email: "qa@example.com", rol: "superadmin", nombre: null }),
  getSession: jest.fn(),
  requireProyectoAccess: jest.fn(),
}));

jest.mock("@/lib/ejecuciones/actions", () => ({
  dispararEjecucion: jest.fn(),
}));

const mockFindUnique = jest.fn();
const mockEjecucionFindFirst = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    casoPrueba: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    ejecucion: {
      findFirst: (...args: unknown[]) => mockEjecucionFindFirst(...args),
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
    expect(dispararEjecucion).not.toHaveBeenCalled();
  });

  it("returns 409 when caso is inactive", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ id: "caso-1", activo: false, proyectoId: "proyecto-1" });
    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });
    expect(res.status).toBe(409);
    expect(dispararEjecucion).not.toHaveBeenCalled();
  });

  it("delega en dispararEjecucion y mapea su resultado al contrato legacy de la ruta", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ id: "caso-1", activo: true, proyectoId: "proyecto-1" });
    (dispararEjecucion as jest.Mock).mockResolvedValue({ id: "ej-1", estado: "corriendo" });

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ejecucionId).toBe("ej-1");
    expect(data.redirectTo).toBe("/ejecuciones/ej-1");
    expect(dispararEjecucion).toHaveBeenCalledWith("caso-1");
  });

  it("returns 409 ejecucion_en_curso cuando dispararEjecucion detecta concurrencia", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    mockFindUnique.mockResolvedValueOnce({ id: "caso-1", activo: true, proyectoId: "proyecto-1" });
    (dispararEjecucion as jest.Mock).mockRejectedValue(YA_EXISTE_EJECUCION_EN_CURSO_ERROR);
    mockEjecucionFindFirst.mockResolvedValueOnce({ id: "ej-en-curso" });

    const req = new Request("http://localhost/...", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "caso-1" }) });

    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("ejecucion_en_curso");
    expect(data.ejecucionId).toBe("ej-en-curso");
  });
});
