import { GET, PUT, DELETE } from "@/app/api/espacios/[id]/route";
import { getEspacioById, updateEspacio, deleteEspacio } from "@/lib/espacios/actions";
import { getSession } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/espacios/actions", () => ({
  getEspacioById: jest.fn(),
  updateEspacio: jest.fn(),
  deleteEspacio: jest.fn(),
  getSession: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("DELETE /api/espacios/[id]/", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 204 on successful delete", async () => {
    (deleteEspacio as jest.Mock).mockResolvedValue({ success: true });

    const request = new Request("http://localhost/api/espacios/espacio-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "espacio-1" }) });

    expect(response.status).toBe(204);
  });

  it("should return 409 when espacio has active proyectos", async () => {
    (deleteEspacio as jest.Mock).mockRejectedValue({
      status: 409,
      body: { error: "conflict", message: "hay proyectos activos" },
    });

    const request = new Request("http://localhost/api/espacios/espacio-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "espacio-1" }) });
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe("conflict");
  });

  it("should return 403 when not superadmin", async () => {
    (deleteEspacio as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });

    const request = new Request("http://localhost/api/espacios/espacio-1", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "espacio-1" }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });

  it("should return 404 when espacio not found", async () => {
    (deleteEspacio as jest.Mock).mockRejectedValue({
      status: 404,
      body: { error: "not_found" },
    });

    const request = new Request("http://localhost/api/espacios/nonexistent", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: "nonexistent" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });
});
