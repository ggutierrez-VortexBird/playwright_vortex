import { listProyectosActivos } from "@/lib/proyectos/actions";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    proyecto: {
      findMany: jest.fn(),
    },
  },
}));

describe("listProyectosActivos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns only active proyectos with espacio included", async () => {
    const mockProyectos = [
      {
        id: "p1",
        nombre: "Proyecto 1",
        espacioId: "e1",
        activo: true,
        espacio: { id: "e1", nombre: "Espacio 1", color: "#ff0000", activo: true, createdAt: new Date(), updatedAt: new Date() },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    (prisma.proyecto.findMany as jest.Mock).mockResolvedValue(mockProyectos);

    const result = await listProyectosActivos();

    expect(prisma.proyecto.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      include: { espacio: true },
      orderBy: { createdAt: "desc" },
    });
    expect(result).toEqual(mockProyectos);
  });

  it("returns empty array when no active proyectos exist", async () => {
    (prisma.proyecto.findMany as jest.Mock).mockResolvedValue([]);

    const result = await listProyectosActivos();

    expect(result).toEqual([]);
    expect(prisma.proyecto.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      include: { espacio: true },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns multiple active proyectos ordered by createdAt desc", async () => {
    const mockProyectos = [
      {
        id: "p2",
        nombre: "Proyecto 2",
        espacioId: "e1",
        activo: true,
        espacio: { id: "e1", nombre: "Espacio 1", color: "#00ff00", activo: true, createdAt: new Date(), updatedAt: new Date() },
        createdAt: new Date("2026-08-10"),
        updatedAt: new Date(),
      },
      {
        id: "p1",
        nombre: "Proyecto 1",
        espacioId: "e1",
        activo: true,
        espacio: { id: "e1", nombre: "Espacio 1", color: "#ff0000", activo: true, createdAt: new Date(), updatedAt: new Date() },
        createdAt: new Date("2026-08-01"),
        updatedAt: new Date(),
      },
    ];
    (prisma.proyecto.findMany as jest.Mock).mockResolvedValue(mockProyectos);

    const result = await listProyectosActivos();

    expect(result).toHaveLength(2);
    expect(prisma.proyecto.findMany).toHaveBeenCalledWith({
      where: { activo: true },
      include: { espacio: true },
      orderBy: { createdAt: "desc" },
    });
  });
});
