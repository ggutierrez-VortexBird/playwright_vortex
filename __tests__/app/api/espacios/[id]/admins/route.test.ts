import { GET, POST, DELETE } from "@/app/api/espacios/[id]/admins/route";
import { getSession } from "@/lib/auth";
import {
  listAdminsEspacio,
  asignarAdminEspacio,
  quitarAdminEspacio,
} from "@/lib/espacios/actions";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/espacios/actions", () => ({
  listAdminsEspacio: jest.fn(),
  asignarAdminEspacio: jest.fn(),
  quitarAdminEspacio: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("GET /api/espacios/[id]/admins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const response = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "espacio-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with {admins: [...]} on success", async () => {
    const mockAdmins = [
      { id: "admin-1", email: "alice@example.com", rol: "admin" },
      { id: "admin-2", email: "bob@example.com", rol: "admin" },
    ];
    (listAdminsEspacio as jest.Mock).mockResolvedValue(mockAdmins);

    const request = new Request("http://localhost/api/espacios/espacio-1/admins", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: "espacio-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.admins).toEqual(mockAdmins);
    expect(listAdminsEspacio).toHaveBeenCalledWith("espacio-1", mockSession);
  });

  it("should return 403 when action throws FORBIDDEN", async () => {
    (listAdminsEspacio as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "no es admin del espacio" },
    });

    const request = new Request("http://localhost/api/espacios/espacio-1/admins", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: "espacio-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });
});

describe("POST /api/espacios/[id]/admins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const request = new Request("http://localhost/api/espacios/espacio-1/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: "user-999" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "espacio-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with the assignment result on success", async () => {
    const mockResult = { ok: true, usuarioId: "user-999", espacioId: "espacio-1" };
    (asignarAdminEspacio as jest.Mock).mockResolvedValue(mockResult);

    const request = new Request("http://localhost/api/espacios/espacio-1/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: "user-999" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "espacio-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(asignarAdminEspacio).toHaveBeenCalledWith(
      "espacio-1",
      "user-999",
      mockSession
    );
  });

  it("should return 404 when action throws not_found", async () => {
    (asignarAdminEspacio as jest.Mock).mockRejectedValue({
      status: 404,
      body: { error: "not_found" },
    });

    const request = new Request("http://localhost/api/espacios/espacio-1/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: "user-999" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "espacio-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });
});

describe("DELETE /api/espacios/[id]/admins", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const request = new Request(
      "http://localhost/api/espacios/espacio-1/admins?usuarioId=user-999",
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "espacio-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 400 when usuarioId query param is missing", async () => {
    const request = new Request("http://localhost/api/espacios/espacio-1/admins", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "espacio-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
    expect(quitarAdminEspacio).not.toHaveBeenCalled();
  });

  it("should return 200 with the removal result on success", async () => {
    const mockResult = { ok: true, usuarioId: "user-999", espacioId: "espacio-1" };
    (quitarAdminEspacio as jest.Mock).mockResolvedValue(mockResult);

    const request = new Request(
      "http://localhost/api/espacios/espacio-1/admins?usuarioId=user-999",
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "espacio-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(quitarAdminEspacio).toHaveBeenCalledWith(
      "espacio-1",
      "user-999",
      mockSession
    );
  });
});
