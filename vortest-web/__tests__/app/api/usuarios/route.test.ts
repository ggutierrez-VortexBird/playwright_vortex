import { GET } from "@/app/api/usuarios/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionData } from "@/lib/auth";

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

jest.mock("@/lib/db", () => ({
  prisma: {
    usuario: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("GET /api/usuarios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const request = new Request("http://localhost/api/usuarios", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return only itself when caller is a tester (no people management)", async () => {
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    // `serializeUsuario` necesita `createdAt` (Date) para hacer `toISOString()`;
    // el mock debe incluir todos los campos que la action espera serializar.
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: "user-123",
      email: "admin@example.com",
      rol: "tester",
      nombre: null,
      activo: true,
      ultimoAccesoAt: null,
      createdAt: new Date("2026-08-01"),
      espacios: [],
    });

    const request = new Request("http://localhost/api/usuarios", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // `serializeUsuario` añade más campos (nombre, activo, fechas ISO, espacios);
    // usamos toMatchObject para verificar los esenciales sin acoplar el test al
    // shape completo de la serialización.
    expect(data.usuarios).toHaveLength(1);
    expect(data.usuarios[0]).toMatchObject({
      id: "user-123",
      email: "admin@example.com",
      rol: "tester",
    });
  });

  it("should return 200 with user list for superadmin", async () => {
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    // Mocks con todos los campos requeridos por `serializeUsuario` (incluido
    // `createdAt` para que `toISOString()` no falle).
    (prisma.usuario.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "alice@example.com", rol: "admin", nombre: null, activo: true, ultimoAccesoAt: null, createdAt: new Date("2026-08-01"), espacios: [] },
      { id: "user-2", email: "bob@example.com", rol: "tester", nombre: null, activo: true, ultimoAccesoAt: null, createdAt: new Date("2026-08-02"), espacios: [] },
    ]);

    const request = new Request("http://localhost/api/usuarios", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.usuarios).toHaveLength(2);
    expect(data.usuarios[0].email).toBe("alice@example.com");
    expect(data.usuarios[1].id).toBe("user-2");
  });
});
