/**
 * Integration test: POST /api/grabador/sesiones
 *
 * - 401 sin sesión
 * - 201 con sesión + input válido (mockea la Server Action)
 * - 400 con JSON inválido
 * - Errors de la action se propagan correctamente
 */

import { POST } from "@/app/api/grabador/sesiones/route";
import { getSession } from "@/lib/auth";
import { iniciarSesionGrabacion } from "@/lib/grabador/actions";

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

jest.mock("@/lib/grabador/actions", () => ({
  iniciarSesionGrabacion: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const validInput = {
  proyectoId: "p1",
  nombre: "Test",
  urlInicial: "https://example.com",
  ambiente: "QA",
  credencialId: "c1",
  navegador: "chromium",
};

describe("POST /api/grabador/sesiones", () => {
  it("returns 401 when no session", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: undefined });

    const req = new Request("http://localhost/api/grabador/sesiones", {
      method: "POST",
      body: JSON.stringify(validInput),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 201 with session result on valid input", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (iniciarSesionGrabacion as jest.Mock).mockResolvedValue({
      sessionId: "ses-1",
      wsUrl: "ws://localhost:3100/?token=abc",
      token: "abc",
    });

    const req = new Request("http://localhost/api/grabador/sesiones", {
      method: "POST",
      body: JSON.stringify(validInput),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.sessionId).toBe("ses-1");
    expect(data.token).toBe("abc");
    expect(data.wsUrl).toBe("ws://localhost:3100/?token=abc");

    // Action fue invocada con el session object + input
    expect(iniciarSesionGrabacion).toHaveBeenCalledWith(
      validInput,
      expect.objectContaining({ userId: "user-1" }),
    );
  });

  it("returns 400 when JSON is invalid", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });

    const req = new Request("http://localhost/api/grabador/sesiones", {
      method: "POST",
      body: "{invalid json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("validation");
  });

  it("returns 503 when action throws recorder unavailable", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (iniciarSesionGrabacion as jest.Mock).mockRejectedValue({
      status: 503,
      body: { error: "recorder_unavailable", message: "down" },
    });

    const req = new Request("http://localhost/api/grabador/sesiones", {
      method: "POST",
      body: JSON.stringify(validInput),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe("recorder_unavailable");
  });

  it("returns 400 when action throws validation error", async () => {
    (getSession as jest.Mock).mockResolvedValue({ userId: "user-1" });
    (iniciarSesionGrabacion as jest.Mock).mockRejectedValue({
      status: 400,
      body: { error: "validation", message: "credencial no pertenece al proyecto" },
    });

    const req = new Request("http://localhost/api/grabador/sesiones", {
      method: "POST",
      body: JSON.stringify(validInput),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});