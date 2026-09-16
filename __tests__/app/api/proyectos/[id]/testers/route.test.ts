import { GET, POST, DELETE } from "@/app/api/proyectos/[id]/testers/route";
import { getSession } from "@/lib/auth";
import {
  listTestersProyecto,
  asignarTesterProyecto,
  quitarTesterProyecto,
} from "@/lib/proyectos/actions";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/proyectos/actions", () => ({
  listTestersProyecto: jest.fn(),
  asignarTesterProyecto: jest.fn(),
  quitarTesterProyecto: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("GET /api/proyectos/[id]/testers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const response = await GET(
      {} as unknown as Request,
      { params: Promise.resolve({ id: "proyecto-1" }) }
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with {testers: [...]} on success", async () => {
    const mockTesters = [
      { id: "tester-1", email: "carol@example.com", rol: "tester" },
      { id: "tester-2", email: "dave@example.com", rol: "tester" },
    ];
    (listTestersProyecto as jest.Mock).mockResolvedValue(mockTesters);

    const request = new Request("http://localhost/api/proyectos/proyecto-1/testers", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: "proyecto-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.testers).toEqual(mockTesters);
    expect(listTestersProyecto).toHaveBeenCalledWith("proyecto-1", mockSession);
  });

  it("should return 403 when action throws FORBIDDEN", async () => {
    (listTestersProyecto as jest.Mock).mockRejectedValue({
      status: 403,
      body: { error: "forbidden", message: "no tiene acceso al proyecto" },
    });

    const request = new Request("http://localhost/api/proyectos/proyecto-1/testers", {
      method: "GET",
    });

    const response = await GET(request, {
      params: Promise.resolve({ id: "proyecto-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("forbidden");
  });
});

describe("POST /api/proyectos/[id]/testers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const request = new Request("http://localhost/api/proyectos/proyecto-1/testers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: "user-999" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "proyecto-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 200 with the assignment result on success", async () => {
    const mockResult = { ok: true, usuarioId: "user-999", proyectoId: "proyecto-1" };
    (asignarTesterProyecto as jest.Mock).mockResolvedValue(mockResult);

    const request = new Request("http://localhost/api/proyectos/proyecto-1/testers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: "user-999" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "proyecto-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(asignarTesterProyecto).toHaveBeenCalledWith(
      "proyecto-1",
      "user-999",
      mockSession
    );
  });

  it("should return 404 when action throws not_found", async () => {
    (asignarTesterProyecto as jest.Mock).mockRejectedValue({
      status: 404,
      body: { error: "not_found" },
    });

    const request = new Request("http://localhost/api/proyectos/proyecto-1/testers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuarioId: "user-999" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ id: "proyecto-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("not_found");
  });
});

describe("DELETE /api/proyectos/[id]/testers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should return 401 when no userId in session", async () => {
    (getSession as jest.Mock).mockResolvedValue({});

    const request = new Request(
      "http://localhost/api/proyectos/proyecto-1/testers?usuarioId=user-999",
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "proyecto-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No autenticado");
  });

  it("should return 400 when usuarioId query param is missing", async () => {
    const request = new Request("http://localhost/api/proyectos/proyecto-1/testers", {
      method: "DELETE",
    });

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "proyecto-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("validation");
    expect(quitarTesterProyecto).not.toHaveBeenCalled();
  });

  it("should return 200 with the removal result on success", async () => {
    const mockResult = { ok: true, usuarioId: "user-999", proyectoId: "proyecto-1" };
    (quitarTesterProyecto as jest.Mock).mockResolvedValue(mockResult);

    const request = new Request(
      "http://localhost/api/proyectos/proyecto-1/testers?usuarioId=user-999",
      { method: "DELETE" }
    );

    const response = await DELETE(request, {
      params: Promise.resolve({ id: "proyecto-1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(quitarTesterProyecto).toHaveBeenCalledWith(
      "proyecto-1",
      "user-999",
      mockSession
    );
  });
});
