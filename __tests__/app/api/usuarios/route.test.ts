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

  it("should return 403 when user is not superadmin", async () => {
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    const request = new Request("http://localhost/api/usuarios", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 200 with user list for superadmin", async () => {
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.usuario.findMany as jest.Mock).mockResolvedValue([
      { id: "user-1", email: "alice@example.com" },
      { id: "user-2", email: "bob@example.com" },
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
    expect(prisma.usuario.findMany).toHaveBeenCalledWith({
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    });
  });
});
