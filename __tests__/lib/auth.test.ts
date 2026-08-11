import { getSession, saveSession, destroySession, sessionOptions, requireSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionData } from "@/lib/auth";

const mockSave = jest.fn();
const mockDestroy = jest.fn();
const mockSession = {
  userId: undefined as string | undefined,
  email: undefined as string | undefined,
  save: mockSave,
  destroy: mockDestroy,
};

jest.mock("iron-session", () => ({
  getIronSession: jest.fn(() => Promise.resolve(mockSession)),
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/lib/db", () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
    },
  },
}));

const mockSuperadminSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.userId = undefined;
    mockSession.email = undefined;
  });

  describe("sessionOptions", () => {
    it("should have cookieName acta_session", () => {
      expect(sessionOptions.cookieName).toBe("acta_session");
    });

    it("should have maxAge of 24 hours", () => {
      expect(sessionOptions.cookieOptions.maxAge).toBe(60 * 60 * 24);
    });

    it("should be secure in production", () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string>).NODE_ENV = "production";
      jest.isolateModules(() => {
        const { sessionOptions: opts } = require("@/lib/auth");
        expect(opts.cookieOptions.secure).toBe(true);
      });
      (process.env as Record<string, string>).NODE_ENV = originalEnv;
    });

    it("should not be secure in development", () => {
      const originalEnv = process.env.NODE_ENV;
      (process.env as Record<string, string>).NODE_ENV = "development";
      jest.isolateModules(() => {
        const { sessionOptions: opts } = require("@/lib/auth");
        expect(opts.cookieOptions.secure).toBe(false);
      });
      (process.env as Record<string, string>).NODE_ENV = originalEnv;
    });
  });

  describe("getSession", () => {
    it("should return an iron session object", async () => {
      const session = await getSession();
      expect(session).toBe(mockSession);
    });
  });

  describe("saveSession", () => {
    it("should set userId and email on session and call save", async () => {
      await saveSession("user-123", "test@example.com");
      expect(mockSession.userId).toBe("user-123");
      expect(mockSession.email).toBe("test@example.com");
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
  });

  describe("destroySession", () => {
    it("should call destroy on the session", async () => {
      await destroySession();
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe("requireSuperadmin", () => {
    it("should throw 403 when userId is missing", async () => {
      await expect(requireSuperadmin({ userId: undefined, email: "" })).rejects.toEqual({
        status: 403,
        body: { error: "forbidden", message: "superadmin required" },
      });
    });

    it("should throw 403 when user.rol !== 'superadmin'", async () => {
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

      await expect(requireSuperadmin(mockSuperadminSession)).rejects.toEqual({
        status: 403,
        body: { error: "forbidden", message: "superadmin required" },
      });
    });

    it("should not throw when user.rol === 'superadmin'", async () => {
      (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });

      await expect(requireSuperadmin(mockSuperadminSession)).resolves.toBeUndefined();
    });
  });
});
