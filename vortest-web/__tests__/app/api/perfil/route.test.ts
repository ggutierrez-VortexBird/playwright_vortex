import { PATCH } from "@/app/api/perfil/route";
import { getSession } from "@/lib/auth";
import { actualizarNombrePropio } from "@/lib/perfil/actions";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/perfil/actions", () => ({
  actualizarNombrePropio: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("PATCH /api/perfil", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const request = new Request("http://localhost/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Gustavo" }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with usuario on valid input", async () => {
    const mockUsuario = {
      id: "user-123",
      email: "admin@example.com",
      nombre: "Gustavo",
      rol: "superadmin",
      activo: true,
    };
    (actualizarNombrePropio as jest.Mock).mockResolvedValue(mockUsuario);

    const request = new Request("http://localhost/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "Gustavo" }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.usuario).toEqual(mockUsuario);
    expect(actualizarNombrePropio).toHaveBeenCalledWith("Gustavo", mockSession);
  });

  it("should return 400 when validation fails", async () => {
    (actualizarNombrePropio as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "nombre is required" },
    });

    const request = new Request("http://localhost/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: "" }),
    });

    const response = await PATCH(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });
});
