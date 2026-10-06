import { prisma } from "@/lib/db";
import {
  actualizarNombrePropio,
  cambiarPasswordPropia,
} from "@/lib/perfil/actions";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getUsuarioActual } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  prisma: {
    usuario: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getUsuarioActual: jest.fn(),
}));

jest.mock("@/lib/password", () => ({
  hashPassword: jest.fn(),
  verifyPassword: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-1",
  email: "test@example.com",
};

const mockActor = { id: "user-1", email: "test@example.com", rol: "tester" };

describe("actualizarNombrePropio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lanza 401 cuando no hay usuario autenticado", async () => {
    (getUsuarioActual as jest.Mock).mockResolvedValue(null);

    await expect(actualizarNombrePropio("Ana", mockSession)).rejects.toEqual({
      status: 401,
      body: { error: "no autenticado" },
    });
  });

  it("rechaza nombres demasiado cortos (<2)", async () => {
    (getUsuarioActual as jest.Mock).mockResolvedValue(mockActor);

    await expect(actualizarNombrePropio("A", mockSession)).rejects.toEqual({
      status: 400,
      body: {
        error: "validation",
        message: "el nombre debe tener entre 2 y 100 caracteres",
      },
    });
  });

  it("rechaza nombres demasiado largos (>100)", async () => {
    (getUsuarioActual as jest.Mock).mockResolvedValue(mockActor);
    const long = "a".repeat(101);

    await expect(actualizarNombrePropio(long, mockSession)).rejects.toEqual({
      status: 400,
      body: {
        error: "validation",
        message: "el nombre debe tener entre 2 y 100 caracteres",
      },
    });
  });

  it("actualiza el nombre y lo devuelve", async () => {
    (getUsuarioActual as jest.Mock).mockResolvedValue(mockActor);
    (prisma.usuario.update as jest.Mock).mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      nombre: "Ana",
      rol: "tester",
    });

    const result = await actualizarNombrePropio("  Ana  ", mockSession);

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { nombre: "Ana" }, // trim aplicado
      select: { id: true, email: true, nombre: true, rol: true },
    });
    expect(result).toEqual({
      id: "user-1",
      email: "test@example.com",
      nombre: "Ana",
      rol: "tester",
    });
  });
});

describe("cambiarPasswordPropia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("lanza 401 cuando no hay usuario autenticado", async () => {
    (getUsuarioActual as jest.Mock).mockResolvedValue(null);

    await expect(
      cambiarPasswordPropia("oldPass123", "newPass123", mockSession),
    ).rejects.toEqual({
      status: 401,
      body: { error: "no autenticado" },
    });
  });

  it("rechaza nueva contraseña <8 caracteres", async () => {
    (getUsuarioActual as jest.Mock).mockResolvedValue(mockActor);

    await expect(
      cambiarPasswordPropia("oldPass123", "short", mockSession),
    ).rejects.toEqual({
      status: 400,
      body: {
        error: "validation",
        message: "la nueva contraseña debe tener al menos 8 caracteres",
      },
    });
  });

  it("rechaza cuando la contraseña actual es incorrecta", async () => {
    (getUsuarioActual as jest.Mock).mockResolvedValue(mockActor);
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      passwordHash: "hashed",
    });
    (verifyPassword as jest.Mock).mockResolvedValue(false);

    await expect(
      cambiarPasswordPropia("wrong", "newValidPassword", mockSession),
    ).rejects.toEqual({
      status: 400,
      body: {
        error: "validation",
        message: "la contraseña actual no es correcta",
      },
    });

    expect(prisma.usuario.update).not.toHaveBeenCalled();
  });

  it("cambia la contraseña cuando la actual es válida", async () => {
    (getUsuarioActual as jest.Mock).mockResolvedValue(mockActor);
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({
      id: "user-1",
      passwordHash: "oldHashed",
    });
    (verifyPassword as jest.Mock).mockResolvedValue(true);
    (hashPassword as jest.Mock).mockResolvedValue("newHashed");

    const result = await cambiarPasswordPropia(
      "oldPass123",
      "newPass123",
      mockSession,
    );

    expect(verifyPassword).toHaveBeenCalledWith("oldPass123", "oldHashed");
    expect(hashPassword).toHaveBeenCalledWith("newPass123");
    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { passwordHash: "newHashed" },
    });
    expect(result).toEqual({ success: true });
  });
});
