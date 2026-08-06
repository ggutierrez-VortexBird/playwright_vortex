import { listEspacios, createEspacio, getEspacioById, updateEspacio, deleteEspacio } from "@/lib/espacios/actions";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  prisma: {
    espacio: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
}));

describe("listEspacios", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return empty array when no espacios exist", async () => {
    (prisma.espacio.findMany as jest.Mock).mockResolvedValue([]);

    const result = await listEspacios();

    expect(result).toEqual([]);
    expect(prisma.espacio.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("should return espacios ordered by createdAt DESC", async () => {
    const mockEspacios = [
      { id: "1", nombre: "Espacio A", color: "#C9822F", activo: true, createdAt: new Date(), updatedAt: new Date() },
      { id: "2", nombre: "Espacio B", color: "#0E6B4F", activo: true, createdAt: new Date(), updatedAt: new Date() },
    ];
    (prisma.espacio.findMany as jest.Mock).mockResolvedValue(mockEspacios);

    const result = await listEspacios();

    expect(result).toHaveLength(2);
    expect(prisma.espacio.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("createEspacio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create espacio successfully", async () => {
    const mockCreated = {
      id: "espacio-1",
      nombre: "Acme Corp",
      color: "#C9822F",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.espacio.create as jest.Mock).mockResolvedValue(mockCreated);

    const result = await createEspacio({ nombre: "Acme Corp", color: "#C9822F" });

    expect(result.nombre).toBe("Acme Corp");
    expect(result.color).toBe("#C9822F");
    expect(result.activo).toBe(true);
  });

  it("should throw 400 when nombre is missing", async () => {
    await expect(createEspacio({ color: "#C9822F" } as any)).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "nombre is required" },
    });
  });

  it("should throw 400 when color is missing", async () => {
    await expect(createEspacio({ nombre: "Acme Corp" } as any)).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "color is required" },
    });
  });

  it("should throw 400 when nombre is empty string", async () => {
    await expect(createEspacio({ nombre: "", color: "#C9822F" })).rejects.toEqual({
      status: 400,
      body: { error: "validation", message: "nombre is required" },
    });
  });

  it("should trim whitespace from nombre and color", async () => {
    const mockCreated = {
      id: "espacio-1",
      nombre: "Acme Corp",
      color: "#C9822F",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.espacio.create as jest.Mock).mockResolvedValue(mockCreated);

    await createEspacio({ nombre: "  Acme Corp  ", color: "  #C9822F  " });

    expect(prisma.espacio.create).toHaveBeenCalledWith({
      data: {
        nombre: "Acme Corp",
        color: "#C9822F",
      },
    });
  });
});

describe("getEspacioById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return espacio when found", async () => {
    const mockEspacio = { id: "abc123", nombre: "Test", color: "#C9822F", activo: true, createdAt: new Date(), updatedAt: new Date() };
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue(mockEspacio);

    const result = await getEspacioById("abc123");

    expect(result).toEqual(mockEspacio);
  });

  it("should return null when espacio not found", async () => {
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getEspacioById("nonexistent");

    expect(result).toBeNull();
  });
});

describe("updateEspacio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should update espacio nombre successfully", async () => {
    const mockUpdated = {
      id: "abc123",
      nombre: "New Name",
      color: "#C9822F",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue({ id: "abc123", activo: true });
    (prisma.espacio.update as jest.Mock).mockResolvedValue(mockUpdated);

    const result = await updateEspacio("abc123", { nombre: "New Name" });

    expect(result.nombre).toBe("New Name");
  });

  it("should update espacio color successfully", async () => {
    const mockUpdated = {
      id: "abc123",
      nombre: "Old Name",
      color: "#33FF57",
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue({ id: "abc123", activo: true });
    (prisma.espacio.update as jest.Mock).mockResolvedValue(mockUpdated);

    const result = await updateEspacio("abc123", { color: "#33FF57" });

    expect(result.color).toBe("#33FF57");
  });

  it("should throw 404 when espacio not found", async () => {
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(updateEspacio("nonexistent", { nombre: "New Name" })).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });
});

describe("deleteEspacio", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should soft delete espacio successfully", async () => {
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue({ id: "abc123", activo: true });
    (prisma.espacio.update as jest.Mock).mockResolvedValue({ id: "abc123", activo: false });

    const result = await deleteEspacio("abc123");

    expect(result).toEqual({ success: true });
    expect(prisma.espacio.update).toHaveBeenCalledWith({
      where: { id: "abc123" },
      data: { activo: false },
    });
  });

  it("should throw 404 when espacio not found", async () => {
    (prisma.espacio.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(deleteEspacio("nonexistent")).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });
});

describe("auth guard integration", () => {
  // Auth is handled at the route handler level, not in the actions.
  // These are tested via integration/e2e tests.
  // The actions themselves do not call getSession - they are pure business logic.
  it("actions should work without session context", async () => {
    (prisma.espacio.findMany as jest.Mock).mockResolvedValue([]);

    // This should work without any session - actions are pure business logic
    const result = await listEspacios();

    expect(result).toEqual([]);
  });
});
