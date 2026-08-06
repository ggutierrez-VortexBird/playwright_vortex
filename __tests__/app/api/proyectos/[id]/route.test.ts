import { GET, PUT, DELETE } from "@/app/api/proyectos/[id]/route";
import { getProyectoById, updateProyecto, deleteProyecto } from "@/lib/proyectos/actions";
import { getSession } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/proyectos/actions", () => ({
  getProyectoById: jest.fn(),
  updateProyecto: jest.fn(),
  deleteProyecto: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("GET /api/proyectos/[id]/", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 200 with proyecto and metrics", async () => {
    const mockProyecto = {
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
    };
    (getProyectoById as jest.Mock).mockResolvedValue(mockProyecto);

    const request = new Request("http://localhost/api/proyectos/proyecto-1", {
      method: "GET",
    });

    const response = await GET(request, { params: Promise.resolve({ id: "proyecto-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombre).toBe("Proyecto Alpha");
    expect(data.totalCasos).toBe(5);
    expect(data.casosConformes).toBe(3);
    expect(data.casosNoConformes).toBe(1);
  });

  it("should return 404 when proyecto not found", async () => {
    (getProyectoById as jest.Mock).mockRejectedValue({
      status: 404,
      body: { error: "not_found" },
    });

    const request = new Request("http://localhost/api/proyectos/nonexistent", {
      method: "GET",
    });

    const response = await GET(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });
});

describe("PUT /api/proyectos/[id]/", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 200 with updated proyecto", async () => {
    const mockUpdated = {
      id: "proyecto-1",
      espacioId: "espacio-1",
      nombre: "Alpha v2",
      ambiente: "PROD",
      descripcion: null,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (updateProyecto as jest.Mock).mockResolvedValue(mockUpdated);

    const request = new Request("http://localhost/api/proyectos/proyecto-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Alpha v2", ambiente: "PROD" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "proyecto-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombre).toBe("Alpha v2");
    expect(data.ambiente).toBe("PROD");
  });

  it("should return 400 when validation fails", async () => {
    (updateProyecto as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "nombre is required" },
    });

    const request = new Request("http://localhost/api/proyectos/proyecto-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "proyecto-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });

  it("should return 403 when not superadmin", async () => {
    (updateProyecto as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });

    const request = new Request("http://localhost/api/proyectos/proyecto-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "New Name" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "proyecto-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 404 when proyecto not found", async () => {
    (updateProyecto as jest.Mock).mockRejectedValue({
      status: 404,
      body: { error: "not_found" },
    });

    const request = new Request("http://localhost/api/proyectos/nonexistent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "New Name" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });
});

describe("DELETE /api/proyectos/[id]/", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 204 on success", async () => {
    (deleteProyecto as jest.Mock).mockResolvedValue({ success: true });

    const request = new Request("http://localhost/api/proyectos/proyecto-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "proyecto-1" }) });

    expect(response.status).toBe(204);
  });

  it("should return 403 when not superadmin", async () => {
    (deleteProyecto as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });

    const request = new Request("http://localhost/api/proyectos/proyecto-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "proyecto-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 404 when proyecto not found", async () => {
    (deleteProyecto as jest.Mock).mockRejectedValue({
      status: 404,
      body: { error: "not_found" },
    });

    const request = new Request("http://localhost/api/proyectos/nonexistent", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });
});
