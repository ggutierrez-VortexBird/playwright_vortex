import { POST } from "@/app/api/perfil/password/route";
import { getSession } from "@/lib/auth";
import { cambiarPasswordPropia } from "@/lib/perfil/actions";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/perfil/actions", () => ({
  cambiarPasswordPropia: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("POST /api/perfil/password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const request = new Request("http://localhost/api/perfil/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual: "oldPass123", nueva: "newPass456" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with {success: true} on valid input", async () => {
    (cambiarPasswordPropia as jest.Mock).mockResolvedValue({ success: true });

    const request = new Request("http://localhost/api/perfil/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual: "oldPass123", nueva: "newPass456" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(cambiarPasswordPropia).toHaveBeenCalledWith(
      "oldPass123",
      "newPass456",
      mockSession
    );
  });

  it("should return 400 when current password is invalid", async () => {
    (cambiarPasswordPropia as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "contraseña actual incorrecta" },
    });

    const request = new Request("http://localhost/api/perfil/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual: "wrongPass", nueva: "newPass456" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });

  it("should return 400 when new password is too short", async () => {
    (cambiarPasswordPropia as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "contraseña nueva demasiado corta" },
    });

    const request = new Request("http://localhost/api/perfil/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actual: "oldPass123", nueva: "123" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
  });
});
