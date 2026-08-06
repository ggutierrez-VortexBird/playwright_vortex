import { getSession, saveSession, destroySession, sessionOptions } from "@/lib/auth";

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
});
