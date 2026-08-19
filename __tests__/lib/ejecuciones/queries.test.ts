// __tests__/lib/ejecuciones/queries.test.ts
// Tests for HU-3 Motor de Ejecución Playwright — AC-4, AC-9, AC-11
//
// El contrato real de la implementación (lib/ejecuciones/queries.ts):
// - `getEjecucionConPasos(id)` retorna la Ejecucion con:
//     casoPrueba: { include: { proyecto: { include: { espacio: true } } } }
//     pasos: orderBy numero asc
// - `listEjecuciones(proyectoId?)` retorna un array de ejecuciones (orden createdAt desc)
//     con casoPrueba → proyecto → espacio (nested include)
// - `listEjecucionesPorProyecto()` retorna `Record<string, Ejecucion[]>` agrupado por proyectoId

import { getEjecucionConPasos, listEjecuciones, listEjecucionesPorProyecto } from "@/lib/ejecuciones/queries";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    ejecucion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe("getEjecucionConPasos (AC-9, AC-11)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna ejecución con pasos ordenados por número asc", async () => {
    // Arrange — el orden en el mock simula el orden que Prisma devolvería
    // después del `orderBy: { numero: 'asc' }` del include.
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
        proyecto: {
          id: "proyecto-1",
          nombre: "Proyecto Alpha",
          espacioId: "esp-1",
          espacio: { id: "esp-1", nombre: "Espacio A" },
        },
      },
      pasos: [
        { id: "paso-1", numero: 1, descripcion: "Primer paso", estado: "paso", duracionMs: 100, selfHealed: false, errorMsg: null, createdAt: new Date() },
        { id: "paso-2", numero: 2, descripcion: "Segundo paso", estado: "fallo", duracionMs: 200, selfHealed: false, errorMsg: "boom", createdAt: new Date() },
        { id: "paso-3", numero: 3, descripcion: "Tercer paso", estado: "paso", duracionMs: 300, selfHealed: false, errorMsg: null, createdAt: new Date() },
      ],
    };
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(mockEjecucion);

    // Act
    const result = await getEjecucionConPasos("ejec-1");

    // Assert
    expect(result).not.toBeNull();
    expect(result!.pasos).toHaveLength(3);
    expect(result!.pasos[0].numero).toBe(1);
    expect(result!.pasos[1].numero).toBe(2);
    expect(result!.pasos[2].numero).toBe(3);
  });

  it("retorna null cuando la ejecución no existe", async () => {
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getEjecucionConPasos("ejec-inexistente");

    expect(result).toBeNull();
  });

  it("incluye datos del casoPrueba y proyecto → espacio anidados", async () => {
    const mockEjecucion = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "paso",
      casoPrueba: {
        id: "caso-1",
        nombre: "Login test",
        codigo: "CP-LOGIN-01",
        proyectoId: "proy-1",
        proyecto: {
          id: "proy-1",
          nombre: "Login Proyecto",
          espacio: { id: "esp-1", nombre: "Espacio Login" },
        },
      },
      pasos: [],
    };
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(mockEjecucion);

    const result = await getEjecucionConPasos("ejec-1");

    expect(result!.casoPrueba.nombre).toBe("Login test");
    expect(result!.casoPrueba.codigo).toBe("CP-LOGIN-01");
    expect(result!.casoPrueba.proyecto.nombre).toBe("Login Proyecto");
    expect(result!.casoPrueba.proyecto.espacio.nombre).toBe("Espacio Login");
  });

  it("incluye artefactos ordenados por createdAt asc", async () => {
    const mockEjecucion = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "paso",
      casoPrueba: {
        id: "caso-1",
        nombre: "Caso Test",
        codigo: "CP-01",
        proyectoId: "proyecto-1",
        proyecto: {
          id: "proyecto-1",
          nombre: "Proyecto Alpha",
          espacioId: "esp-1",
          espacio: { id: "esp-1", nombre: "Espacio A" },
        },
      },
      pasos: [],
      artefactos: [
        { id: "art-1", tipo: "video", nombre: "video.webm", path: "/storage/artefactos/ejec-1/video.webm", sha256: "abc", bytes: 1024, createdAt: new Date("2026-08-12T10:00:00Z") },
        { id: "art-2", tipo: "captura", nombre: "screenshot.png", path: "/storage/artefactos/ejec-1/screenshot.png", sha256: "def", bytes: 512, createdAt: new Date("2026-08-12T10:01:00Z") },
      ],
    };
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(mockEjecucion);

    const result = await getEjecucionConPasos("ejec-1");

    expect(result).not.toBeNull();
    expect(result!.artefactos).toHaveLength(2);
    expect(result!.artefactos[0].id).toBe("art-1");
    expect(result!.artefactos[1].id).toBe("art-2");
    expect(result!.artefactos[0].tipo).toBe("video");

    // Verify the query includes artefactos ordered by createdAt
    expect(prisma.ejecucion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          artefactos: expect.objectContaining({
            orderBy: { createdAt: "asc" },
          }),
        }),
      })
    );
  });

  it("retorna artefactos vacíos cuando la ejecución no tiene evidencia", async () => {
    const mockEjecucion = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "paso",
      casoPrueba: {
        id: "caso-1",
        nombre: "Caso Test",
        codigo: "CP-01",
        proyectoId: "proyecto-1",
        proyecto: {
          id: "proyecto-1",
          nombre: "Proyecto Alpha",
          espacioId: "esp-1",
          espacio: { id: "esp-1", nombre: "Espacio A" },
        },
      },
      pasos: [],
      artefactos: [],
    };
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(mockEjecucion);

    const result = await getEjecucionConPasos("ejec-1");

    expect(result).not.toBeNull();
    expect(result!.artefactos).toEqual([]);
  });
});

describe("listEjecuciones (AC-4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna array de ejecuciones ordenadas por createdAt desc", async () => {
    const mockEjecuciones = [
      {
        id: "ejec-2",
        estado: "corriendo",
        createdAt: new Date("2026-08-12T11:00:00Z"),
        casoPrueba: {
          id: "caso-2",
          nombre: "Caso B",
          codigo: "CP-B",
          proyectoId: "proy-1",
          proyecto: {
            id: "proy-1",
            nombre: "Proyecto Alpha",
            espacio: { id: "esp-1", nombre: "Espacio A" },
          },
        },
      },
      {
        id: "ejec-1",
        estado: "paso",
        createdAt: new Date("2026-08-12T10:00:00Z"),
        casoPrueba: {
          id: "caso-1",
          nombre: "Caso A",
          codigo: "CP-A",
          proyectoId: "proy-1",
          proyecto: {
            id: "proy-1",
            nombre: "Proyecto Alpha",
            espacio: { id: "esp-1", nombre: "Espacio A" },
          },
        },
      },
    ];
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue(mockEjecuciones);

    const result = await listEjecuciones();

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("ejec-2");
    expect(result[1].id).toBe("ejec-1");
  });

  it("filtra por proyectoId cuando se especifica", async () => {
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    await listEjecuciones("proy-1");

    expect(prisma.ejecucion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          casoPrueba: { proyectoId: "proy-1" },
        }),
      })
    );
  });

  it("incluye proyecto anidado con espacio para que la página pueda agrupar", async () => {
    const mockEjecuciones = [
      {
        id: "ejec-1",
        estado: "paso",
        casoPrueba: {
          id: "caso-1",
          nombre: "Caso A",
          proyectoId: "proy-1",
          proyecto: {
            id: "proy-1",
            nombre: "Proyecto Alpha",
            espacio: { id: "esp-1", nombre: "Espacio A" },
          },
        },
      },
    ];
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue(mockEjecuciones);

    const result = await listEjecuciones();

    expect(result[0].casoPrueba.proyecto.nombre).toBe("Proyecto Alpha");
    expect(result[0].casoPrueba.proyecto.espacio.nombre).toBe("Espacio A");
  });

  it("retorna array vacío cuando no hay ejecuciones", async () => {
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await listEjecuciones();

    expect(result).toEqual([]);
  });
});

describe("listEjecucionesPorProyecto (AC-4)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("agrupa ejecuciones por proyectoId en un Record<string, Ejecucion[]>", async () => {
    // listEjecucionesPorProyecto llama a listEjecuciones() y agrupa por casoPrueba.proyectoId.
    // Mockeamos findMany para que devuelva tres ejecuciones de dos proyectos distintos.
    const mockEjecuciones = [
      {
        id: "ejec-1",
        estado: "paso",
        casoPrueba: {
          id: "caso-1",
          proyectoId: "proy-1",
          proyecto: { id: "proy-1", nombre: "Proyecto Alpha", espacio: { id: "esp-1", nombre: "Espacio A" } },
        },
      },
      {
        id: "ejec-2",
        estado: "fallo",
        casoPrueba: {
          id: "caso-2",
          proyectoId: "proy-1",
          proyecto: { id: "proy-1", nombre: "Proyecto Alpha", espacio: { id: "esp-1", nombre: "Espacio A" } },
        },
      },
      {
        id: "ejec-3",
        estado: "pendiente",
        casoPrueba: {
          id: "caso-3",
          proyectoId: "proy-2",
          proyecto: { id: "proy-2", nombre: "Proyecto Beta", espacio: { id: "esp-2", nombre: "Espacio B" } },
        },
      },
    ];
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue(mockEjecuciones);

    // Act
    const result = await listEjecucionesPorProyecto();

    // Assert: es un Record (objeto), no un array — clave es proyectoId
    expect(typeof result).toBe("object");
    expect(Array.isArray(result)).toBe(false);
    expect(Object.keys(result).sort()).toEqual(["proy-1", "proy-2"]);
    expect(result["proy-1"]).toHaveLength(2);
    expect(result["proy-2"]).toHaveLength(1);
    expect(result["proy-1"][0].id).toBe("ejec-1");
    expect(result["proy-2"][0].casoPrueba.proyecto.nombre).toBe("Proyecto Beta");
  });

  it("retorna Record vacío cuando no hay ejecuciones", async () => {
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await listEjecucionesPorProyecto();

    expect(result).toEqual({});
  });
});
