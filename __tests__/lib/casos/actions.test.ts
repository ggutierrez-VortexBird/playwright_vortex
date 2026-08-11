import {
  createCaso,
  updateCaso,
  deleteCaso,
  getCasoById,
  listCasos,
} from "@/lib/casos/actions";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  prisma: {
    casoPrueba: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ejecucion: {
      findMany: jest.fn(),
    },
    usuario: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  ...jest.requireActual("@/lib/auth"),
  getSession: jest.fn(),
}));

const mockSession: SessionData = {
  userId: "user-123",
  email: "admin@example.com",
};

describe("createCaso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw 403 when user is not superadmin", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    await expect(
      createCaso(
        {
          codigo: "CP-TEST-01",
          nombre: "Caso Test",
          script: "import { test } from '@playwright/test'; ...",
          responsableId: "user-456",
          proyectoId: "proyecto-1",
        },
        mockSession
      )
    ).rejects.toEqual({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });
  });

  it("should throw 400 when script is empty", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });

    await expect(
      createCaso(
        {
          codigo: "CP-TEST-01",
          nombre: "Caso Test",
          script: "",
          responsableId: "user-456",
          proyectoId: "proyecto-1",
        },
        mockSession
      )
    ).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "script is required" },
    });
  });

  it("should throw 409 when codigo is duplicate in proyecto (P2002)", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.casoPrueba.create as jest.Mock).mockRejectedValue({ code: "P2002" });

    await expect(
      createCaso(
        {
          codigo: "CP-DUP-01",
          nombre: "Caso Duplicado",
          script: "import { test } from '@playwright/test'; ...",
          responsableId: "user-456",
          proyectoId: "proyecto-1",
        },
        mockSession
      )
    ).rejects.toEqual({
      status: 409,
      body: { error: "conflict", message: "Código duplicado en este proyecto" },
    });
  });

  it("should create caso successfully with valid data", async () => {
    const mockCreated = {
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-TEST-01",
      nombre: "Caso Test",
      script: "import { test } from '@playwright/test'; ...",
      scriptFileName: "example.spec.ts",
      responsableId: "user-456",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.casoPrueba.create as jest.Mock).mockResolvedValue(mockCreated);

    const result = await createCaso(
      {
        codigo: "CP-TEST-01",
        nombre: "Caso Test",
        script: "import { test } from '@playwright/test'; ...",
        scriptFileName: "example.spec.ts",
        responsableId: "user-456",
        proyectoId: "proyecto-1",
      },
      mockSession
    );

    expect(result.codigo).toBe("CP-TEST-01");
    expect(result.nombre).toBe("Caso Test");
    expect(result.script).toBe("import { test } from '@playwright/test'; ...");
    expect(result.scriptFileName).toBe("example.spec.ts");
    expect(result.estado).toBe("sin ejecuciones");
    expect(prisma.casoPrueba.create).toHaveBeenCalledWith({
      data: {
        codigo: "CP-TEST-01",
        nombre: "Caso Test",
        script: "import { test } from '@playwright/test'; ...",
        scriptFileName: "example.spec.ts",
        responsableId: "user-456",
        proyectoId: "proyecto-1",
      },
    });
  });

  it("should throw 400 when codigo is missing", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });

    await expect(
      createCaso(
        {
          nombre: "Caso Test",
          script: "import { test } from '@playwright/test'; ...",
          responsableId: "user-456",
          proyectoId: "proyecto-1",
        } as any,
        mockSession
      )
    ).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "codigo is required" },
    });
  });

  it("should throw 400 when nombre is missing", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });

    await expect(
      createCaso(
        {
          codigo: "CP-TEST-01",
          script: "import { test } from '@playwright/test'; ...",
          responsableId: "user-456",
          proyectoId: "proyecto-1",
        } as any,
        mockSession
      )
    ).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "nombre is required" },
    });
  });
});

describe("listCasos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return casos with estado computed from latest ejecucion", async () => {
    const mockCasos = [
      {
        id: "caso-1",
        proyectoId: "proyecto-1",
        codigo: "CP-TEST-01",
        nombre: "Caso A",
        script: "test('a', ...)",
        scriptFileName: "a.spec.ts",
        responsableId: "user-456",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        proyecto: { nombre: "Proyecto Alpha" },
        responsable: { email: "test@example.com" },
        ejecuciones: [
          { estado: "paso", finAt: new Date("2026-08-01"), inicioAt: new Date("2026-08-01"), pasos: [{ id: "p1" }, { id: "p2" }] },
        ],
      },
      {
        id: "caso-2",
        proyectoId: "proyecto-1",
        codigo: "CP-TEST-02",
        nombre: "Caso B",
        script: "test('b', ...)",
        scriptFileName: "b.spec.ts",
        responsableId: "user-456",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        proyecto: { nombre: "Proyecto Alpha" },
        responsable: { email: "test@example.com" },
        ejecuciones: [],
      },
    ];
    (prisma.casoPrueba.findMany as jest.Mock).mockResolvedValue(mockCasos);

    const result = await listCasos("proyecto-1");

    expect(result).toHaveLength(2);
    expect(result[0].estado).toBe("paso");
    expect(result[1].estado).toBe("sin ejecuciones");
    expect(prisma.casoPrueba.findMany).toHaveBeenCalledWith({
      where: { proyectoId: "proyecto-1", activo: true },
      include: {
        proyecto: { select: { nombre: true } },
        responsable: { select: { email: true } },
        ejecuciones: { include: { pasos: { select: { id: true } } }, orderBy: { finAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("should return all casos when no proyectoId filter", async () => {
    const mockCasos = [
      {
        id: "caso-1",
        proyectoId: "proyecto-1",
        codigo: "CP-TEST-01",
        nombre: "Caso A",
        script: "test('a', ...)",
        scriptFileName: "a.spec.ts",
        responsableId: "user-456",
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        proyecto: { nombre: "Proyecto Alpha" },
        responsable: { email: "test@example.com" },
        ejecuciones: [],
      },
    ];
    (prisma.casoPrueba.findMany as jest.Mock).mockResolvedValue(mockCasos);

    const result = await listCasos();

    expect(result).toHaveLength(1);
    expect(prisma.casoPrueba.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      include: {
        proyecto: { select: { nombre: true } },
        responsable: { select: { email: true } },
        ejecuciones: { include: { pasos: { select: { id: true } } }, orderBy: { finAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("getCasoById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return caso with proyecto and responsable names", async () => {
    const mockCaso = {
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-TEST-01",
      nombre: "Caso A",
      script: "test('a', ...)",
      scriptFileName: "a.spec.ts",
      responsableId: "user-456",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      proyecto: { nombre: "Proyecto Alpha" },
      responsable: { email: "test@example.com" },
      ejecuciones: [
        { estado: "fallo", finAt: new Date("2026-08-01"), inicioAt: new Date("2026-08-01") },
      ],
    };
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(mockCaso);

    const result = await getCasoById("caso-1");

    expect(result.id).toBe("caso-1");
    expect(result.proyectoNombre).toBe("Proyecto Alpha");
    expect(result.responsableEmail).toBe("test@example.com");
    expect(result.estado).toBe("fallo");
  });

  it("should throw 404 when caso not found", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getCasoById("nonexistent")).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });
});

describe("updateCaso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw 403 when user is not superadmin", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    await expect(updateCaso("caso-1", { nombre: "New Name" }, mockSession)).rejects.toEqual({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });
  });

  it("should throw 400 when script is empty on update", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({ id: "caso-1", activo: true });

    await expect(
      updateCaso("caso-1", { script: "" }, mockSession)
    ).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "script is required" },
    });
  });

  it("should throw 409 when codigo duplicate on update (P2002)", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({ id: "caso-1", activo: true });
    (prisma.casoPrueba.update as jest.Mock).mockRejectedValue({ code: "P2002" });

    await expect(
      updateCaso("caso-1", { codigo: "CP-DUP-01" }, mockSession)
    ).rejects.toEqual({
      status: 409,
      body: { error: "conflict", message: "Código duplicado en este proyecto" },
    });
  });

  it("should update caso with partial fields", async () => {
    const mockUpdated = {
      id: "caso-1",
      proyectoId: "proyecto-1",
      codigo: "CP-TEST-01",
      nombre: "New Name",
      script: "test('new', ...)",
      scriptFileName: "new.spec.ts",
      responsableId: "user-456",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({ id: "caso-1", activo: true });
    (prisma.casoPrueba.update as jest.Mock).mockResolvedValue(mockUpdated);

    const result = await updateCaso("caso-1", { nombre: "New Name", script: "test('new', ...)", scriptFileName: "new.spec.ts" }, mockSession);

    expect(result.nombre).toBe("New Name");
    expect(result.script).toBe("test('new', ...)");
    expect(result.scriptFileName).toBe("new.spec.ts");
    expect(prisma.casoPrueba.update).toHaveBeenCalledWith({
      where: { id: "caso-1" },
      data: { nombre: "New Name", script: "test('new', ...)", scriptFileName: "new.spec.ts" },
    });
  });

  it("should throw 404 when caso not found", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(updateCaso("nonexistent", { nombre: "New Name" }, mockSession)).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });
});

describe("deleteCaso", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw 403 when user is not superadmin", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    await expect(deleteCaso("caso-1", mockSession)).rejects.toEqual({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });
  });

  it("should soft delete caso successfully", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({ id: "caso-1", activo: true });
    (prisma.casoPrueba.update as jest.Mock).mockResolvedValue({ id: "caso-1", activo: false });

    const result = await deleteCaso("caso-1", mockSession);

    expect(result).toEqual({ success: true });
    expect(prisma.casoPrueba.update).toHaveBeenCalledWith({
      where: { id: "caso-1" },
      data: { activo: false },
    });
  });

  it("should throw 404 when caso not found", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(deleteCaso("nonexistent", mockSession)).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });
});
