import { GET, POST } from "@/app/api/casos/route";
import { listCasos, createCaso } from "@/lib/casos/actions";
import { getSession } from "@/lib/auth";
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

jest.mock("@/lib/casos/actions", () => ({
  listCasos: jest.fn(),
  createCaso: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("POST /api/casos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 201 with created caso on valid input", async () => {
    const mockCreated = {
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-TEST-01",
      nombre: "Caso Test",
      rutaScript: "tests/example.spec.ts",
      responsableId: "user-456",
      estado: "sin ejecuciones",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (createCaso as jest.Mock).mockResolvedValue(mockCreated);

    const request = new Request("http://localhost/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: "CP-TEST-01",
        nombre: "Caso Test",
        rutaScript: "tests/example.spec.ts",
        responsableId: "user-456",
        proyectoId: "proyecto-1",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.codigo).toBe("CP-TEST-01");
    expect(data.estado).toBe("sin ejecuciones");
  });

  it("should return 400 when script validation fails", async () => {
    (createCaso as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "Script no accesible" },
    });

    const request = new Request("http://localhost/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: "CP-TEST-01",
        nombre: "Caso Test",
        rutaScript: "invalid/path.ts",
        responsableId: "user-456",
        proyectoId: "proyecto-1",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });

  it("should return 409 when codigo is duplicate", async () => {
    (createCaso as jest.Mock).mockRejectedValue({
      status: 409,
      body: { error: "conflict", message: "Código duplicado en este proyecto" },
    });

    const request = new Request("http://localhost/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: "CP-DUP-01",
        nombre: "Caso Duplicado",
        rutaScript: "tests/example.spec.ts",
        responsableId: "user-456",
        proyectoId: "proyecto-1",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("conflict");
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const request = new Request("http://localhost/api/casos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: "CP-TEST-01",
        nombre: "Caso Test",
        rutaScript: "tests/example.spec.ts",
        responsableId: "user-456",
        proyectoId: "proyecto-1",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });
});

describe("GET /api/casos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 200 with all casos when no proyectoId", async () => {
    const mockCasos = [
      {
        id: "caso-1",
        proyectoId: "proyecto-1",
        proyectoNombre: "Proyecto Alpha",
        codigo: "CP-TEST-01",
        nombre: "Caso A",
        rutaScript: "tests/a.spec.ts",
        responsableId: "user-456",
        responsableEmail: "test@example.com",
        estado: "sin ejecuciones",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    (listCasos as jest.Mock).mockResolvedValue(mockCasos);

    const request = new Request("http://localhost/api/casos", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.casos).toHaveLength(1);
    expect(data.casos[0].codigo).toBe("CP-TEST-01");
    expect(listCasos).toHaveBeenCalledWith(undefined);
  });

  it("should return 200 with filtered casos when proyectoId provided", async () => {
    const mockCasos = [
      {
        id: "caso-1",
        proyectoId: "proyecto-1",
        proyectoNombre: "Proyecto Alpha",
        codigo: "CP-TEST-01",
        nombre: "Caso A",
        rutaScript: "tests/a.spec.ts",
        responsableId: "user-456",
        responsableEmail: "test@example.com",
        estado: "paso",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    (listCasos as jest.Mock).mockResolvedValue(mockCasos);

    const request = new Request("http://localhost/api/casos?proyectoId=proyecto-1", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.casos).toHaveLength(1);
    expect(data.casos[0].estado).toBe("paso");
    expect(listCasos).toHaveBeenCalledWith("proyecto-1");
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const request = new Request("http://localhost/api/casos", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });
});
