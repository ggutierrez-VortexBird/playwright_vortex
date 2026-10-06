import { PATCH } from "@/app/api/usuarios/[id]/route";
import { getSession } from "@/lib/auth";
import { updateUsuarioRolEstado } from "@/lib/usuarios/actions";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/usuarios/actions", () => ({
  updateUsuarioRolEstado: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("PATCH /api/usuarios/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const request = new Request("http://localhost/api/usuarios/user-999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol: "admin", activo: true }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with {usuario} on valid input", async () => {
    const mockUsuario = {
      id: "user-999",
      email: "alice@example.com",
      rol: "admin",
      activo: true,
    };
    (updateUsuarioRolEstado as jest.Mock).mockResolvedValue(mockUsuario);

    const request = new Request("http://localhost/api/usuarios/user-999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol: "admin", activo: true }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.usuario).toEqual(mockUsuario);
    expect(updateUsuarioRolEstado).toHaveBeenCalledWith(
      "user-999",
      { rol: "admin", activo: true },
      mockSession
    );
  });

  it("should return 400 when validation fails", async () => {
    (updateUsuarioRolEstado as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "rol inválido" },
    });

    const request = new Request("http://localhost/api/usuarios/user-999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol: "invalido" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });

  it("should return 403 when caller is not superadmin", async () => {
    (updateUsuarioRolEstado as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });

    const request = new Request("http://localhost/api/usuarios/user-999", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rol: "admin" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "user-999" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });
});
