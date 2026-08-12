// __tests__/lib/ejecuciones/queries.test.ts
// RED test — testing functionality that doesn't exist yet
// These tests verify AC-4, AC-9, AC-11 (queries for executions with steps)

import { getEjecucionConPasos, listEjecuciones } from "@/lib/ejecuciones/queries";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    ejecucion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    pasoEjecucion: {
      findMany: jest.fn(),
    },
  },
}));

describe("getEjecucionConPasos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna ejecución con pasos ordenados por número asc — AC-11", async () => {
    // Arrange
    const mockEjecucion = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "corriendo",
      inicioAt: new Date(),
      finAt: null,
      duracionMs: null,
      errorMsg: null,
      casoPrueba: {
        id: "caso-1",
        nombre: "Caso Test",
        codigo: "CP-01",
        proyectoId: "proyecto-1",
      },
      pasos: [
        { id: "paso-3", numero: 3, descripcion: "Tercer paso", estado: "paso", duracionMs: 300 },
        { id: "paso-1", numero: 1, descripcion: "Primer paso", estado: "paso", duracionMs: 100 },
        { id: "paso-2", numero: 2, descripcion: "Segundo paso", estado: "fallo", duracionMs: 200 },
      ],
    };
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(mockEjecucion);

    // Act
    const result = await getEjecucionConPasos("ejec-1");

    // Assert
    expect(result).toBeDefined();
    expect(result!.pasos).toHaveLength(3);
    // Must be ordered by numero asc
    expect(result!.pasos[0].numero).toBe(1);
    expect(result!.pasos[1].numero).toBe(2);
    expect(result!.pasos[2].numero).toBe(3);
  });

  it("retorna null cuando la ejecución no existe", async () => {
    // Arrange
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(null);

    // Act
    const result = await getEjecucionConPasos("ejec-inexistente");

    // Assert
    expect(result).toBeNull();
  });

  it("incluye datos del casoPrueba — AC-9", async () => {
    // Arrange
    const mockEjecucion = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "paso",
      casoPrueba: { id: "caso-1", nombre: "Login test", codigo: "CP-LOGIN-01", proyectoId: "proy-1" },
      pasos: [],
    };
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(mockEjecucion);

    // Act
    const result = await getEjecucionConPasos("ejec-1");

    // Assert
    expect(result!.casoPrueba.nombre).toBe("Login test");
    expect(result!.casoPrueba.codigo).toBe("CP-LOGIN-01");
  });
});

describe("listEjecuciones", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna todas las ejecuciones ordenadas por createdAt desc — AC-4", async () => {
    // Arrange
    const mockEjecuciones = [
      {
        id: "ejec-2",
        estado: "corriendo",
        createdAt: new Date("2026-08-12T11:00:00Z"),
        casoPrueba: {
          id: "caso-2",
          nombre: "Caso B",
          codigo: "CP-B",
          proyecto: { id: "proy-1", nombre: "Proyecto Alpha" },
        },
        pasos: [],
      },
      {
        id: "ejec-1",
        estado: "paso",
        createdAt: new Date("2026-08-12T10:00:00Z"),
        casoPrueba: {
          id: "caso-1",
          nombre: "Caso A",
          codigo: "CP-A",
          proyecto: { id: "proy-1", nombre: "Proyecto Alpha" },
        },
        pasos: [],
      },
    ];
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue(mockEjecuciones);

    // Act
    const result = await listEjecuciones();

    // Assert
    expect(result).toHaveLength(2);
    // Most recent first
    expect(result[0].id).toBe("ejec-2");
    expect(result[1].id).toBe("ejec-1");
  });

  it("filtra por proyectoId cuando se especifica — AC-4", async () => {
    // Arrange
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    // Act
    await listEjecuciones("proy-1");

    // Assert
    expect(prisma.ejecucion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          casoPrueba: { proyectoId: "proy-1" },
        }),
      })
    );
  });

  it("incluye proyecto anidado para agrupar por proyecto — AC-4", async () => {
    // Arrange
    const mockEjecuciones = [
      {
        id: "ejec-1",
        estado: "paso",
        casoPrueba: {
          id: "caso-1",
          nombre: "Caso A",
          proyecto: { id: "proy-1", nombre: "Proyecto Alpha" },
        },
        pasos: [],
      },
    ];
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue(mockEjecuciones);

    // Act
    const result = await listEjecuciones();

    // Assert
    expect(result[0].casoPrueba.proyecto.nombre).toBe("Proyecto Alpha");
  });

  it("retorna array vacío cuando no hay ejecuciones", async () => {
    // Arrange
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    // Act
    const result = await listEjecuciones();

    // Assert
    expect(result).toEqual([]);
  });
});
