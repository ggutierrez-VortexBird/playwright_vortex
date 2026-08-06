import { GET, PUT, DELETE } from "@/app/api/casos/[id]/route";
import { getCasoById, updateCaso, deleteCaso } from "@/lib/casos/actions";
import { getSession } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

jest.mock("next/server", () => ({
  NextResponse: Object.assign(
    function NextResponse(body: any, init?: ResponseInit) {
      return new Response(body, init);
    },
    {
      json: (body: any, init?: ResponseInit) =>
        new Response(JSON.stringify(body), {
          ...init,
          headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
        }),
    }
  ),
}));

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getSession: jest.fn(),
}));

jest.mock("@/lib/casos/actions", () => ({
  getCasoById: jest.fn(),
  updateCaso: jest.fn(),
  deleteCaso: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("GET /api/casos/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 200 with caso data", async () => {
    const mockCaso = {
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
    };
    (getCasoById as jest.Mock).mockResolvedValue(mockCaso);

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "GET",
    });

    const response = await GET(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("caso-1");
    expect(data.estado).toBe("paso");
    expect(getCasoById).toHaveBeenCalledWith("caso-1");
  });

  it("should return 404 when caso not found", async () => {
    (getCasoById as jest.Mock).mockRejectedValue({
      status: 404,
      body: { error: "not_found" },
    });

    const request = new Request("http://localhost/api/casos/nonexistent", {
      method: "GET",
    });

    const response = await GET(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "GET",
    });

    const response = await GET(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });
});

describe("PUT /api/casos/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 200 with updated caso", async () => {
    const mockUpdated = {
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-TEST-01",
      nombre: "Updated Name",
      rutaScript: "tests/updated.spec.ts",
      responsableId: "user-456",
      estado: "sin ejecuciones",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (updateCaso as jest.Mock).mockResolvedValue(mockUpdated);

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Updated Name", rutaScript: "tests/updated.spec.ts" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombre).toBe("Updated Name");
    expect(updateCaso).toHaveBeenCalledWith("caso-1", { nombre: "Updated Name", rutaScript: "tests/updated.spec.ts" }, mockSession);
  });

  it("should return 400 when script validation fails", async () => {
    (updateCaso as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "Script no accesible" },
    });

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rutaScript: "invalid/path.ts" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });

  it("should return 403 when not superadmin", async () => {
    (updateCaso as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Updated Name" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Updated Name" }),
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });
});

describe("DELETE /api/casos/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 204 on successful delete", async () => {
    (deleteCaso as jest.Mock).mockResolvedValue({ success: true });

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "caso-1" }) });

    expect(response.status).toBe(204);
    expect(deleteCaso).toHaveBeenCalledWith("caso-1", mockSession);
  });

  it("should return 404 when caso not found", async () => {
    (deleteCaso as jest.Mock).mockRejectedValue({
      status: 404,
      body: { error: "not_found" },
    });

    const request = new Request("http://localhost/api/casos/nonexistent", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });

  it("should return 403 when not superadmin", async () => {
    (deleteCaso as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const request = new Request("http://localhost/api/casos/caso-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });
});
