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

// Polyfill File.prototype.text for Jest environment
if (!File.prototype.text) {
  Object.defineProperty(File.prototype, "text", {
    value: function () {
      return Promise.resolve("mock file content");
    },
  });
}

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

function createMockRequest(id: string, body: Record<string, string | File>): Request {
  const formData = new Map<string, string | File>();
  for (const [key, value] of Object.entries(body)) {
    formData.set(key, value);
  }

  return {
    formData: jest.fn().mockResolvedValue({
      get: (key: string) => formData.get(key) || null,
    }),
  } as unknown as Request;
}

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
      script: "test('a', ...)",
      scriptFileName: "a.spec.ts",
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
      script: "test('updated', ...)",
      scriptFileName: "updated.spec.ts",
      responsableId: "user-456",
      estado: "sin ejecuciones",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (updateCaso as jest.Mock).mockResolvedValue(mockUpdated);

    const file = new File(["updated content"], "updated.spec.ts", { type: "text/typescript" });
    const request = createMockRequest("caso-1", {
      nombre: "Updated Name",
      scriptFile: file,
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombre).toBe("Updated Name");
    expect(updateCaso).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({ nombre: "Updated Name", script: "mock file content", scriptFileName: "updated.spec.ts" }),
      mockSession
    );
  });

  it("should return 200 when updating without new script file", async () => {
    const mockUpdated = {
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-TEST-01",
      nombre: "Updated Name",
      script: "test('a', ...)",
      scriptFileName: "a.spec.ts",
      responsableId: "user-456",
      estado: "sin ejecuciones",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (updateCaso as jest.Mock).mockResolvedValue(mockUpdated);

    const request = createMockRequest("caso-1", {
      nombre: "Updated Name",
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nombre).toBe("Updated Name");
    expect(updateCaso).toHaveBeenCalledWith("caso-1", { nombre: "Updated Name" }, mockSession);
  });

  it("should accept a plain-text script field (inline editor save, no file upload)", async () => {
    const mockUpdated = {
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-TEST-01",
      nombre: "Caso A",
      script: "await page.goto('https://edited.example');",
      scriptFileName: "a.spec.ts",
      responsableId: "user-456",
      estado: "sin ejecuciones",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (updateCaso as jest.Mock).mockResolvedValue(mockUpdated);

    const request = createMockRequest("caso-1", {
      script: "await page.goto('https://edited.example');",
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.script).toBe("await page.goto('https://edited.example');");
    expect(updateCaso).toHaveBeenCalledWith(
      "caso-1",
      { script: "await page.goto('https://edited.example');" },
      mockSession,
    );
  });

  it("prefers the uploaded scriptFile over a plain-text script field if both are sent", async () => {
    const mockUpdated = {
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-TEST-01",
      nombre: "Caso A",
      script: "mock file content",
      scriptFileName: "file.spec.ts",
      responsableId: "user-456",
      estado: "sin ejecuciones",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (updateCaso as jest.Mock).mockResolvedValue(mockUpdated);

    const file = new File(["file content"], "file.spec.ts", { type: "text/typescript" });
    const request = createMockRequest("caso-1", {
      script: "esto no debería usarse",
      scriptFile: file,
    });

    await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });

    expect(updateCaso).toHaveBeenCalledWith(
      "caso-1",
      expect.objectContaining({ script: "mock file content" }),
      mockSession,
    );
  });

  it("should return 400 when script file has invalid extension", async () => {
    const file = new File(["test content"], "invalid.txt", { type: "text/plain" });
    const request = createMockRequest("caso-1", {
      nombre: "Updated Name",
      scriptFile: file,
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
    expect(data.message).toBe(
      "El archivo debe ser .spec.ts, .test.ts, .spec.js o .test.js",
    );
  });

  it("should return 400 when updateCaso throws validation error", async () => {
    (updateCaso as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "script is required" },
    });

    const request = createMockRequest("caso-1", {
      nombre: "Updated Name",
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

    const request = createMockRequest("caso-1", {
      nombre: "Updated Name",
    });

    const response = await PUT(request, { params: Promise.resolve({ id: "caso-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const request = createMockRequest("caso-1", {
      nombre: "Updated Name",
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
