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

function createMockRequest(body: Record<string, string | File>): Request {
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
      script: "import { test } from '@playwright/test'; ...",
      scriptFileName: "example.spec.ts",
      responsableId: "user-456",
      estado: "sin ejecuciones",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (createCaso as jest.Mock).mockResolvedValue(mockCreated);

    const file = new File(["test content"], "example.spec.ts", { type: "text/typescript" });
    const request = createMockRequest({
      codigo: "CP-TEST-01",
      nombre: "Caso Test",
      scriptFile: file,
      responsableId: "user-456",
      proyectoId: "proyecto-1",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.codigo).toBe("CP-TEST-01");
    expect(data.estado).toBe("sin ejecuciones");
  });

  it("should return 400 when scriptFile is missing", async () => {
    const request = createMockRequest({
      codigo: "CP-TEST-01",
      nombre: "Caso Test",
      responsableId: "user-456",
      proyectoId: "proyecto-1",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
    expect(data.message).toBe("Debes seleccionar un archivo de script");
  });

  it("should return 400 when script file has invalid extension", async () => {
    const file = new File(["test content"], "invalid.txt", { type: "text/plain" });
    const request = createMockRequest({
      codigo: "CP-TEST-01",
      nombre: "Caso Test",
      scriptFile: file,
      responsableId: "user-456",
      proyectoId: "proyecto-1",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
    expect(data.message).toBe("El archivo debe ser .spec.ts o .test.ts");
  });

  it("should return 400 when createCaso throws validation error", async () => {
    (createCaso as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "script is required" },
    });

    const file = new File(["test content"], "example.spec.ts", { type: "text/typescript" });
    const request = createMockRequest({
      codigo: "CP-TEST-01",
      nombre: "Caso Test",
      scriptFile: file,
      responsableId: "user-456",
      proyectoId: "proyecto-1",
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

    const file = new File(["test content"], "example.spec.ts", { type: "text/typescript" });
    const request = createMockRequest({
      codigo: "CP-DUP-01",
      nombre: "Caso Duplicado",
      scriptFile: file,
      responsableId: "user-456",
      proyectoId: "proyecto-1",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("conflict");
  });

  it("should return 401 when not authenticated", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const file = new File(["test content"], "example.spec.ts", { type: "text/typescript" });
    const request = createMockRequest({
      codigo: "CP-TEST-01",
      nombre: "Caso Test",
      scriptFile: file,
      responsableId: "user-456",
      proyectoId: "proyecto-1",
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
        scriptFileName: "a.spec.ts",
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
        scriptFileName: "a.spec.ts",
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
