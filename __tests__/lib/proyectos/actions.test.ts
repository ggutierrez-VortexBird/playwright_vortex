import {
  createProyecto,
  listProyectosByEspacio,
  getProyectoById,
  updateProyecto,
  deleteProyecto,
  getMetrics,
} from "@/lib/proyectos/actions";
import { requireSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  prisma: {
    proyecto: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    espacio: {
      findUnique: jest.fn(),
    },
    casoPrueba: {
      findMany: jest.fn(),
    },
    ejecucion: {
      groupBy: jest.fn(),
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

describe("requireSuperadmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should throw 403 when user.rol !== 'superadmin'", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    await expect(requireSuperadmin(mockSession)).rejects.toEqual({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });
  });

  it("should not throw when user.rol === 'superadmin'", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });

    await expect(requireSuperadmin(mockSession)).resolves.toBeUndefined();
  });
});

describe("createProyecto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should throw 400 when nombre is missing/empty", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });

    await expect(
      createProyecto({ ambiente: "QA", espacioId: "espacio-1" } as any, mockSession)
    ).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "nombre is required" },
    });
  });

  it("should throw 400 when ambiente is missing/empty", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });

    await expect(
      createProyecto({ nombre: "Proyecto Test", espacioId: "espacio-1" } as any, mockSession)
    ).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "ambiente is required" },
    });
  });

  it("should throw 400 when espacioId is missing", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });

    await expect(
      createProyecto({ nombre: "Proyecto Test", ambiente: "QA" } as any, mockSession)
    ).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "espacioId is required" },
    });
  });

  it("should throw 403 when user is not superadmin", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    await expect(
      createProyecto({ nombre: "Proyecto Test", ambiente: "QA", espacioId: "espacio-1" }, mockSession)
    ).rejects.toEqual({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });
  });

  it("should throw 404 when espacio does not exist", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      createProyecto({ nombre: "Proyecto Test", ambiente: "QA", espacioId: "nonexistent" }, mockSession)
    ).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });

  it("should create proyecto and return it on valid input", async () => {
    const mockCreated = {
      id: "proyecto-1",
      espacioId: "espacio-1",
      nombre: "Proyecto Alpha",
      ambiente: "QA",
      descripcion: null,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue({ id: "espacio-1", nombre: "Espacio Test" });
    (prisma.proyecto.create as jest.Mock).mockResolvedValue(mockCreated);

    const result = await createProyecto(
      { nombre: "Proyecto Alpha", ambiente: "QA", espacioId: "espacio-1" },
      mockSession
    );

    expect(result.nombre).toBe("Proyecto Alpha");
    expect(result.ambiente).toBe("QA");
    expect(result.espacioId).toBe("espacio-1");
    expect(prisma.proyecto.create).toHaveBeenCalledWith({
      data: {
        nombre: "Proyecto Alpha",
        ambiente: "QA",
        espacioId: "espacio-1",
      },
    });
  });
});

describe("listProyectosByEspacio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return only proyectos from specified espacioId", async () => {
    const mockProyectos = [
      {
        id: "proyecto-1",
        espacioId: "espacio-1",
        nombre: "Proyecto A",
        ambiente: "QA",
        descripcion: null,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "proyecto-2",
        espacioId: "espacio-1",
        nombre: "Proyecto B",
        ambiente: "DEV",
        descripcion: null,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    (prisma.proyecto.findMany as jest.Mock).mockResolvedValue(mockProyectos);

    const result = await listProyectosByEspacio("espacio-1");

    expect(result).toHaveLength(2);
    expect(prisma.proyecto.findMany).toHaveBeenCalledWith({
      where: { espacioId: "espacio-1", activo: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("should return empty array when no proyectos exist", async () => {
    (prisma.proyecto.findMany as jest.Mock).mockResolvedValue([]);

    const result = await listProyectosByEspacio("espacio-empty");

    expect(result).toEqual([]);
    expect(prisma.proyecto.findMany).toHaveBeenCalledWith({
      where: { espacioId: "espacio-empty", activo: true },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("getProyectoById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return proyecto with metrics", async () => {
    const mockProyecto = {
      id: "proyecto-1",
      espacioId: "espacio-1",
      nombre: "Proyecto Alpha",
      ambiente: "QA",
      descripcion: null,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.proyecto.findUnique as jest.Mock).mockResolvedValue(mockProyecto);
    (prisma.casoPrueba.findMany as jest.Mock).mockResolvedValue([
      { id: "caso-1" },
      { id: "caso-2" },
      { id: "caso-3" },
    ]);
    (prisma.ejecucion.groupBy as jest.Mock).mockResolvedValue([
      { casoPruebaId: "caso-1", id: "ejec-1" },
      { casoPruebaId: "caso-2", id: "ejec-2" },
      { casoPruebaId: "caso-3", id: "ejec-3" },
    ]);
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([
      { casoPruebaId: "caso-1", estado: "paso", finAt: new Date("2026-08-01") },
      { casoPruebaId: "caso-2", estado: "paso", finAt: new Date("2026-08-02") },
      { casoPruebaId: "caso-3", estado: "fallo", finAt: new Date("2026-08-03") },
    ]);

    const result = await getProyectoById("proyecto-1");

    expect(result.id).toBe("proyecto-1");
    expect(result.totalCasos).toBe(3);
    expect(result.casosConformes).toBe(2);
    expect(result.casosNoConformes).toBe(1);
    expect(result.fechaUltimaEjecucion).toBeTruthy();
  });

  it("should throw 404 when proyecto not found", async () => {
    (prisma.proyecto.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(getProyectoById("nonexistent")).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });
});

describe("updateProyecto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should throw 403 when user is not superadmin", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    await expect(
      updateProyecto("proyecto-1", { nombre: "New Name" }, mockSession)
    ).rejects.toEqual({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });
  });

  it("should throw 404 when proyecto not found", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.proyecto.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      updateProyecto("nonexistent", { nombre: "New Name" }, mockSession)
    ).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });

  it("should update only provided fields", async () => {
    const mockUpdated = {
      id: "proyecto-1",
      espacioId: "espacio-1",
      nombre: "New Name",
      ambiente: "QA",
      descripcion: null,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.proyecto.findUnique as jest.Mock).mockResolvedValue({
      id: "proyecto-1",
      espacioId: "espacio-1",
      nombre: "Old Name",
      ambiente: "QA",
      activo: true,
    });
    (prisma.proyecto.update as jest.Mock).mockResolvedValue(mockUpdated);

    const result = await updateProyecto("proyecto-1", { nombre: "New Name" }, mockSession);

    expect(result.nombre).toBe("New Name");
    expect(prisma.proyecto.update).toHaveBeenCalledWith({
      where: { id: "proyecto-1" },
      data: { nombre: "New Name" },
    });
  });
});

describe("deleteProyecto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it("should throw 403 when user is not superadmin", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    await expect(deleteProyecto("proyecto-1", mockSession)).rejects.toEqual({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });
  });

  it("should throw 404 when proyecto not found", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.proyecto.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(deleteProyecto("nonexistent", mockSession)).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });

  it("should set activo: false (soft delete)", async () => {
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "superadmin" });
    (prisma.proyecto.findUnique as jest.Mock).mockResolvedValue({ id: "proyecto-1", activo: true });
    (prisma.proyecto.update as jest.Mock).mockResolvedValue({ id: "proyecto-1", activo: false });

    const result = await deleteProyecto("proyecto-1", mockSession);

    expect(result).toEqual({ success: true });
    expect(prisma.proyecto.update).toHaveBeenCalledWith({
      where: { id: "proyecto-1" },
      data: { activo: false },
    });
  });
});

describe("getMetrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return correct totalCasos count", async () => {
    (prisma.casoPrueba.findMany as jest.Mock).mockResolvedValue([
      { id: "caso-1" },
      { id: "caso-2" },
      { id: "caso-3" },
      { id: "caso-4" },
      { id: "caso-5" },
    ]);
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getMetrics("proyecto-1");

    expect(result.totalCasos).toBe(5);
  });

  it("should return correct casosConformes from latest execution per caso", async () => {
    (prisma.casoPrueba.findMany as jest.Mock).mockResolvedValue([
      { id: "caso-1" },
      { id: "caso-2" },
      { id: "caso-3" },
    ]);
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([
      { casoPruebaId: "caso-1", estado: "paso", finAt: new Date("2026-08-03") },
      { casoPruebaId: "caso-1", estado: "fallo", finAt: new Date("2026-08-01") },
      { casoPruebaId: "caso-2", estado: "paso", finAt: new Date("2026-08-02") },
      { casoPruebaId: "caso-3", estado: "fallo", finAt: new Date("2026-08-01") },
    ]);

    const result = await getMetrics("proyecto-1");

    expect(result.casosConformes).toBe(2);
    expect(result.casosNoConformes).toBe(1);
  });

  it("should return correct casosNoConformes from latest execution per caso", async () => {
    (prisma.casoPrueba.findMany as jest.Mock).mockResolvedValue([
      { id: "caso-1" },
      { id: "caso-2" },
    ]);
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([
      { casoPruebaId: "caso-1", estado: "fallo", finAt: new Date("2026-08-02") },
      { casoPruebaId: "caso-2", estado: "fallo", finAt: new Date("2026-08-01") },
    ]);

    const result = await getMetrics("proyecto-1");

    expect(result.casosNoConformes).toBe(2);
    expect(result.casosConformes).toBe(0);
  });

  it("should return null fechaUltimaEjecucion when no executions exist", async () => {
    (prisma.casoPrueba.findMany as jest.Mock).mockResolvedValue([
      { id: "caso-1" },
      { id: "caso-2" },
    ]);
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getMetrics("proyecto-1");

    expect(result.fechaUltimaEjecucion).toBeNull();
  });

  it("should return 0 counts when proyecto has no casos", async () => {
    (prisma.casoPrueba.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getMetrics("proyecto-empty");

    expect(result.totalCasos).toBe(0);
    expect(result.casosConformes).toBe(0);
    expect(result.casosNoConformes).toBe(0);
    expect(result.fechaUltimaEjecucion).toBeNull();
  });
});
