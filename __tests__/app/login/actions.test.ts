import { iniciarSesion } from "@/app/login/actions";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { saveSession } from "@/lib/auth";
import { redirect } from "next/navigation";

jest.mock("@/lib/db", () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/password", () => ({
  verifyPassword: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  saveSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("iniciarSesion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should redirect on valid credentials", async () => {
    const mockUser = {
      id: "user-1",
      email: "admin@admin.com",
      passwordHash: "hashed",
      rol: "superadmin",
    };
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const formData = new FormData();
    formData.set("email", "admin@admin.com");
    formData.set("password", "correctpassword");

    await iniciarSesion({}, formData);

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: { email: "admin@admin.com" },
    });
    expect(verifyPassword).toHaveBeenCalledWith("correctpassword", "hashed");
    expect(saveSession).toHaveBeenCalledWith("user-1", "admin@admin.com");
    expect(redirect).toHaveBeenCalledWith("/");
  });

  it("should return generic error for wrong password", async () => {
    const mockUser = {
      id: "user-1",
      email: "admin@admin.com",
      passwordHash: "hashed",
      rol: "superadmin",
    };
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (verifyPassword as jest.Mock).mockResolvedValue(false);

    const formData = new FormData();
    formData.set("email", "admin@admin.com");
    formData.set("password", "wrongpassword");

    const result = await iniciarSesion({}, formData);

    expect(result).toEqual({ error: "Credenciales inválidas" });
    expect(saveSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should return generic error for non-existent email", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(null);

    const formData = new FormData();
    formData.set("email", "nobody@example.com");
    formData.set("password", "somepassword");

    const result = await iniciarSesion({}, formData);

    expect(result).toEqual({ error: "Credenciales inválidas" });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(saveSession).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("should redirect to callbackUrl when provided", async () => {
    const mockUser = {
      id: "user-1",
      email: "admin@admin.com",
      passwordHash: "hashed",
      rol: "superadmin",
    };
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const formData = new FormData();
    formData.set("email", "admin@admin.com");
    formData.set("password", "correctpassword");
    formData.set("from", "/proyectos");

    await iniciarSesion({}, formData);

    expect(redirect).toHaveBeenCalledWith("/proyectos");
  });

  it("should trim email input", async () => {
    const mockUser = {
      id: "user-1",
      email: "admin@admin.com",
      passwordHash: "hashed",
      rol: "superadmin",
    };
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const formData = new FormData();
    formData.set("email", "  admin@admin.com  ");
    formData.set("password", "correctpassword");

    await iniciarSesion({}, formData);

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({
      where: { email: "admin@admin.com" },
    });
  });
});
