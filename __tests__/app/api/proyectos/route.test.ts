import { GET, POST } from "@/app/api/proyectos/route";
import { createProyecto, listProyectosByEspacio } from "@/lib/proyectos/actions";
import { getSession } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/proyectos/actions", () => ({
  createProyecto: jest.fn(),
  listProyectosByEspacio: jest.fn(),
  getMetrics: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("POST /api/proyectos/", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 201 with created proyecto on valid input", async () => {
    const mockCreated = {
      id: "proyecto-1",
      espacioId: "espacio-1",
      nombre: "Proyecto Alpha",
      ambiente: "QA",
      descripcion: null,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (createProyecto as jest.Mock).mockResolvedValue(mockCreated);

    const request = new Request("http://localhost/api/proyectos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Proyecto Alpha", ambiente: "QA", espacioId: "espacio-1" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.nombre).toBe("Proyecto Alpha");
    expect(data.ambiente).toBe("QA");
  });

  it("should return 400 when validation fails", async () => {
    (createProyecto as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "nombre is required" },
    });

    const request = new Request("http://localhost/api/proyectos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ambiente: "QA", espacioId: "espacio-1" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });

  it("should return 403 when not superadmin", async () => {
    (createProyecto as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });

    const request = new Request("http://localhost/api/proyectos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Proyecto Alpha", ambiente: "QA", espacioId: "espacio-1" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const request = new Request("http://localhost/api/proyectos/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Proyecto Alpha", ambiente: "QA", espacioId: "espacio-1" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });
});

describe("GET /api/proyectos/?espacioId=X", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 200 with array of proyectos with metrics", async () => {
    const mockProyectos = [
      {
        id: "proyecto-1",
        espacioId: "espacio-1",
        nombre: "Proyecto Alpha",
        ambiente: "QA",
        descripcion: null,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        totalCasos: 5,
        casosConformes: 3,
        casosNoConformes: 1,
        fechaUltimaEjecucion: "2026-08-01T00:00:00.000Z",
      },
    ];
    (listProyectosByEspacio as jest.Mock).mockResolvedValue(mockProyectos);

    const request = new Request("http://localhost/api/proyectos/?espacioId=espacio-1", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.proyectos).toHaveLength(1);
    expect(data.proyectos[0].nombre).toBe("Proyecto Alpha");
    expect(data.proyectos[0].totalCasos).toBe(5);
  });

  it("should return only proyectos from specified espacioId", async () => {
    (listProyectosByEspacio as jest.Mock).mockResolvedValue([]);

    const request = new Request("http://localhost/api/proyectos/?espacioId=espacio-1", {
      method: "GET",
    });

    await GET(request);

    expect(listProyectosByEspacio).toHaveBeenCalledWith("espacio-1");
  });

  it("should return 400 when espacioId is missing", async () => {
    const request = new Request("http://localhost/api/proyectos/", {
      method: "GET",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });
});
