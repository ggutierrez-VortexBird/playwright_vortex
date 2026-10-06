import { GET, PUT } from "@/app/api/usuarios/[id]/espacios/route";
import { getSession } from "@/lib/auth";
import { listEspaciosDeUsuario, setEspaciosDeUsuario } from "@/lib/usuarios/actions";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/usuarios/actions", () => ({
  listEspaciosDeUsuario: jest.fn(),
  setEspaciosDeUsuario: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("GET /api/usuarios/[id]/espacios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const response = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "user-999" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with {espacios: [...]} on success", async () => {
    const mockEspacios = [
      { id: "esp-1", nombre: "Acme", color: "#C9822F" },
      { id: "esp-2", nombre: "Globex", color: "#0E6B4F" },
    ];
    (listEspaciosDeUsuario as jest.Mock).mockResolvedValue(mockEspacios);

    const request = new Request("http://localhost/api/usuarios/user-999/espacios", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.espacios).toEqual(mockEspacios);
    expect(listEspaciosDeUsuario).toHaveBeenCalledWith("user-999", mockSession);
  });
});

describe("PUT /api/usuarios/[id]/espacios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const request = new Request("http://localhost/api/usuarios/user-999/espacios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioIds: ["esp-1"] }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with {espacios} on success", async () => {
    const mockEspacios = [
      { id: "esp-1", nombre: "Acme", color: "#C9822F" },
      { id: "esp-2", nombre: "Globex", color: "#0E6B4F" },
    ];
    (setEspaciosDeUsuario as jest.Mock).mockResolvedValue(mockEspacios);

    const request = new Request("http://localhost/api/usuarios/user-999/espacios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioIds: ["esp-1", "esp-2"] }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.espacios).toEqual(mockEspacios);
    expect(setEspaciosDeUsuario).toHaveBeenCalledWith(
      "user-999",
      ["esp-1", "esp-2"],
      mockSession
    );
  });

  it("should pass an empty array when espacioIds is missing", async () => {
    const mockEspacios: Array<{ id: string; nombre: string }> = [];
    (setEspaciosDeUsuario as jest.Mock).mockResolvedValue(mockEspacios);

    const request = new Request("http://localhost/api/usuarios/user-999/espacios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.espacios).toEqual([]);
    expect(setEspaciosDeUsuario).toHaveBeenCalledWith(
      "user-999",
      [],
      mockSession
    );
  });

  it("should pass an empty array when espacioIds is not an array", async () => {
    const mockEspacios: Array<{ id: string; nombre: string }> = [];
    (setEspaciosDeUsuario as jest.Mock).mockResolvedValue(mockEspacios);

    const request = new Request("http://localhost/api/usuarios/user-999/espacios", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ espacioIds: "no-es-array" }),
    });

    const response = await PUT(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.espacios).toEqual([]);
    expect(setEspaciosDeUsuario).toHaveBeenCalledWith(
      "user-999",
      [],
      mockSession
    );
  });
});
