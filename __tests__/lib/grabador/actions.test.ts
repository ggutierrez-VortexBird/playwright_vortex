/**
 * Tests para la Server Action orquestadora `iniciarSesionGrabacion`.
 *
 * Flujo que debe validar (HU-G1):
 *   1. requireSuperadmin(session)
 *   2. Validar input (nombre, urlInicial formato, ambiente enum, navegador)
 *   3. Verificar que la credencial pertenece al proyecto (decrypt + comparación)
 *   4. Crear fila SesionGrabacion con estado='iniciando'
 *   5. POST /internal/start al recorder-worker
 *   6. UPDATE SesionGrabacion SET token=..., tokenUsado=true, wsUrl=...
 *   7. Retornar {sessionId, wsUrl, token}
 *
 * Errores esperados:
 *   - 401 si no hay session
 *   - 403 si no es superadmin
 *   - 400 si input inválido
 *   - 400 si credencial no pertenece al proyecto
 *   - 503 si recorder no disponible o MAX_SESSIONS
 */

import { iniciarSesionGrabacion } from "@/lib/grabador/actions";
import { decryptCredencial } from "@/lib/credenciales/crypto";

// Mock prisma
const mockCredencialFindFirst = jest.fn();
const mockSesionCreate = jest.fn();
const mockSesionUpdate = jest.fn();

jest.mock("@/lib/db", () => ({
  prisma: {
    credencial: {
      findFirst: (...args: unknown[]) => mockCredencialFindFirst(...args),
    },
    sesionGrabacion: {
      create: (...args: unknown[]) => mockSesionCreate(...args),
      update: (...args: unknown[]) => mockSesionUpdate(...args),
    },
  },
}));

// Mock recorder-client
const mockCallInternalStart = jest.fn();

jest.mock("@/lib/grabador/recorder-client", () => ({
  callInternalStart: (...args: unknown[]) => mockCallInternalStart(...args),
  RecorderMaxSessionsError: class extends Error {
    constructor(m: string) {
      super(m);
      this.name = "RecorderMaxSessionsError";
    }
  },
  RecorderUnavailableError: class extends Error {
    constructor(m: string) {
      super(m);
      this.name = "RecorderUnavailableError";
    }
  },
}));

// Mock auth — requireSuperadmin throws FORBIDDEN_ERROR
jest.mock("@/lib/auth", () => {
  const actual = jest.requireActual("@/lib/auth");
  return {
    ...actual,
    requireSuperadmin: jest.fn(),
    getSession: jest.fn(),
  };
});

import {
  getSession,
  requireSuperadmin,
  FORBIDDEN_ERROR,
} from "@/lib/auth";

beforeAll(() => {
  process.env.SESSION_SECRET =
    process.env.SESSION_SECRET || "test-secret-32chars-min-AAA-BBB-CCC-DDD-EEE-FFF";
  process.env.RECORDER_INTERNAL_URL = "http://localhost:3100";
  process.env.RECORDER_INTERNAL_SECRET = "test-internal-secret";
});

beforeEach(() => {
  jest.clearAllMocks();
});

const mockSuperadminSession = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("lib/grabador/actions — iniciarSesionGrabacion", () => {
  describe("auth", () => {
    it("throws FORBIDDEN_ERROR when requireSuperadmin fails", async () => {
      (requireSuperadmin as jest.Mock).mockRejectedValue(FORBIDDEN_ERROR);

      await expect(
        iniciarSesionGrabacion(
          {
            proyectoId: "p1",
            nombre: "Test",
            urlInicial: "https://example.com",
            ambiente: "QA",
            credencialId: "c1",
            navegador: "chromium",
          },
          mockSuperadminSession,
        ),
      ).rejects.toBe(FORBIDDEN_ERROR);

      expect(requireSuperadmin).toHaveBeenCalledWith(mockSuperadminSession);
    });
  });

  describe("input validation", () => {
    beforeEach(() => {
      (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
    });

    it("throws validation error when nombre is empty", async () => {
      await expect(
        iniciarSesionGrabacion(
          {
            proyectoId: "p1",
            nombre: "  ",
            urlInicial: "https://example.com",
            ambiente: "QA",
            credencialId: "c1",
            navegador: "chromium",
          },
          mockSuperadminSession,
        ),
      ).rejects.toMatchObject({ status: 400, body: { error: "validation" } });
    });

    it("throws validation error when urlInicial is not http/https", async () => {
      await expect(
        iniciarSesionGrabacion(
          {
            proyectoId: "p1",
            nombre: "Test",
            urlInicial: "ftp://example.com",
            ambiente: "QA",
            credencialId: "c1",
            navegador: "chromium",
          },
          mockSuperadminSession,
        ),
      ).rejects.toMatchObject({ status: 400, body: { error: "validation" } });
    });

    it("throws validation error when ambiente is invalid", async () => {
      await expect(
        iniciarSesionGrabacion(
          {
            proyectoId: "p1",
            nombre: "Test",
            urlInicial: "https://example.com",
            ambiente: "Invalid" as any,
            credencialId: "c1",
            navegador: "chromium",
          },
          mockSuperadminSession,
        ),
      ).rejects.toMatchObject({ status: 400, body: { error: "validation" } });
    });

    it("throws validation error when navegador is not chromium", async () => {
      await expect(
        iniciarSesionGrabacion(
          {
            proyectoId: "p1",
            nombre: "Test",
            urlInicial: "https://example.com",
            ambiente: "QA",
            credencialId: "c1",
            navegador: "firefox" as any,
          },
          mockSuperadminSession,
        ),
      ).rejects.toMatchObject({ status: 400, body: { error: "validation" } });
    });
  });

  describe("happy path", () => {
    beforeEach(() => {
      (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
      mockSesionCreate.mockResolvedValue({ id: "ses-1" });
      mockSesionUpdate.mockResolvedValue({});
      mockCallInternalStart.mockResolvedValue({
        token: "valid-token",
        wsUrl: "ws://localhost:3100/?token=valid-token",
      });
    });

    it("creates SesionGrabacion with estado='iniciando' before calling recorder", async () => {
      // Mock encrypted credencial with empty storageState
      const { encryptCredencial } = await import("@/lib/credenciales/crypto");
      const valor = encryptCredencial(JSON.stringify({ cookies: [], origins: [] }));
      mockCredencialFindFirst.mockResolvedValue({
        id: "c1",
        proyectoId: "p1",
        nombre: "Demo QA",
        tipo: "storageState",
        valor,
      });

      const result = await iniciarSesionGrabacion(
        {
          proyectoId: "p1",
          nombre: "Test",
          urlInicial: "https://example.com",
          ambiente: "QA",
          credencialId: "c1",
          navegador: "chromium",
        },
        mockSuperadminSession,
      );

      expect(mockSesionCreate).toHaveBeenCalledTimes(1);
      const createArgs = mockSesionCreate.mock.calls[0][0];
      expect(createArgs.data.estado).toBe("iniciando");
      expect(createArgs.data.proyectoId).toBe("p1");
      expect(createArgs.data.usuarioId).toBe("user-123");
      expect(createArgs.data.urlInicial).toBe("https://example.com");

      expect(mockCallInternalStart).toHaveBeenCalledTimes(1);
      const startArgs = mockCallInternalStart.mock.calls[0][0];
      expect(startArgs.sessionId).toBe("ses-1");
      expect(startArgs.userId).toBe("user-123");
      expect(startArgs.urlInicial).toBe("https://example.com");
      // Storage state decifrado
      expect(startArgs.storageState).toEqual({ cookies: [], origins: [] });

      expect(mockSesionUpdate).toHaveBeenCalledTimes(1);
      const updateArgs = mockSesionUpdate.mock.calls[0][0];
      expect(updateArgs.data.token).toBe("valid-token");

      expect(result.sessionId).toBe("ses-1");
      expect(result.token).toBe("valid-token");
      expect(result.wsUrl).toBe("ws://localhost:3100/?token=valid-token");
    });

    it("returns 400 when credencial does not belong to proyecto", async () => {
      mockCredencialFindFirst.mockResolvedValue(null);

      await expect(
        iniciarSesionGrabacion(
          {
            proyectoId: "p1",
            nombre: "Test",
            urlInicial: "https://example.com",
            ambiente: "QA",
            credencialId: "c1",
            navegador: "chromium",
          },
          mockSuperadminSession,
        ),
      ).rejects.toMatchObject({
        status: 400,
        body: { error: "validation", message: expect.stringContaining("credencial") },
      });

      expect(mockCallInternalStart).not.toHaveBeenCalled();
    });
  });

  describe("recorder errors", () => {
    beforeEach(() => {
      (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
      const { encryptCredencial } = require("@/lib/credenciales/crypto");
      mockCredencialFindFirst.mockResolvedValue({
        id: "c1",
        proyectoId: "p1",
        nombre: "Demo QA",
        tipo: "storageState",
        valor: encryptCredencial(JSON.stringify({ cookies: [], origins: [] })),
      });
      mockSesionCreate.mockResolvedValue({ id: "ses-1" });
    });

    it("throws 503 when recorder MAX_SESSIONS", async () => {
      const { RecorderMaxSessionsError } = await import(
        "@/lib/grabador/recorder-client"
      );
      mockCallInternalStart.mockRejectedValue(
        new RecorderMaxSessionsError("registry lleno"),
      );

      await expect(
        iniciarSesionGrabacion(
          {
            proyectoId: "p1",
            nombre: "Test",
            urlInicial: "https://example.com",
            ambiente: "QA",
            credencialId: "c1",
            navegador: "chromium",
          },
          mockSuperadminSession,
        ),
      ).rejects.toMatchObject({ status: 503 });
    });

    it("throws 503 when recorder unavailable", async () => {
      const { RecorderUnavailableError } = await import(
        "@/lib/grabador/recorder-client"
      );
      mockCallInternalStart.mockRejectedValue(
        new RecorderUnavailableError("connection refused"),
      );

      await expect(
        iniciarSesionGrabacion(
          {
            proyectoId: "p1",
            nombre: "Test",
            urlInicial: "https://example.com",
            ambiente: "QA",
            credencialId: "c1",
            navegador: "chromium",
          },
          mockSuperadminSession,
        ),
      ).rejects.toMatchObject({ status: 503 });
    });
  });
});