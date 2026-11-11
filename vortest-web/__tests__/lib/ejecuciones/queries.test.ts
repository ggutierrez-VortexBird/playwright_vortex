// Contrato de getEjecucionConPasos, listEjecuciones y listEjecucionesPorProyecto.

import { getEjecucionConPasos, listEjecuciones, listEjecucionesPorProyecto } from "@/lib/ejecuciones/queries";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    ejecucion: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
  },
}));

describe("getEjecucionConPasos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna ejecución con pasos ordenados por número asc", async () => {
    // El orden del mock simula el orderBy asc del include de Prisma
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

    const result = await getEjecucionConPasos("ejec-1");

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

    // La query incluye artefactos ordenados por createdAt
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

  it("incluye subacciones anidadas dentro de cada paso", async () => {
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
      pasos: [
        {
          id: "paso-1",
          numero: 1,
          descripcion: "Primer paso",
          estado: "paso",
          duracionMs: 100,
          selfHealed: false,
          errorMsg: null,
          resultadoEsperado: "Debe cargar",
          resultadoObtenido: "Cargó OK",
          errorCount: 0,
          logs: null,
          createdAt: new Date(),
          subacciones: [
            { id: "sub-1", numero: 1, descripcion: "Sub-paso 1", estado: "paso", duracionMs: 50, tipo: "action", errorMsg: null, logs: null },
          ],
        },
      ],
      artefactos: [],
    };
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(mockEjecucion);

    const result = await getEjecucionConPasos("ejec-1");

    expect(result).not.toBeNull();
    expect(result!.pasos).toHaveLength(1);
    expect(result!.pasos[0].subacciones).toHaveLength(1);
    expect(result!.pasos[0].subacciones[0].descripcion).toBe("Sub-paso 1");

    // La query incluye subacciones en el include de pasos
    expect(prisma.ejecucion.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          pasos: expect.objectContaining({
            include: expect.objectContaining({
              subacciones: expect.any(Object),
            }),
          }),
        }),
      })
    );
  });

  it("incluye nuevos campos de entorno y aserciones en la ejecución", async () => {
    const mockEjecucion = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "paso",
      entorno: "Producción",
      navegador: "Chrome 115",
      sistemaOperativo: "Linux (Ubuntu)",
      nodoEjecucion: "192.168.1.104",
      asercionesTotal: 124,
      asercionesOk: 118,
      asercionesFail: 6,
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
    expect(result!.entorno).toBe("Producción");
    expect(result!.navegador).toBe("Chrome 115");
    expect(result!.asercionesTotal).toBe(124);
    expect(result!.asercionesOk).toBe(118);
    expect(result!.asercionesFail).toBe(6);
  });
});

describe("listEjecuciones", () => {
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

    expect(Array.isArray(result.ejecuciones)).toBe(true);
    expect(result.ejecuciones).toHaveLength(2);
    expect(result.ejecuciones[0].id).toBe("ejec-2");
    expect(result.ejecuciones[1].id).toBe("ejec-1");
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

    expect(result.ejecuciones[0].casoPrueba.proyecto.nombre).toBe("Proyecto Alpha");
    expect(result.ejecuciones[0].casoPrueba.proyecto.espacio.nombre).toBe("Espacio A");
  });

  it("retorna array vacío cuando no hay ejecuciones", async () => {
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await listEjecuciones();

    expect(result).toEqual({ ejecuciones: [], hasNextPage: false, total: 0 });
  });
});

describe("listEjecucionesPorProyecto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("agrupa ejecuciones por proyectoId en un Record<string, Ejecucion[]>", async () => {
    // Agrupa por casoPrueba.proyectoId; findMany devuelve tres ejecuciones de dos proyectos.
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

    const result = await listEjecucionesPorProyecto();

    // Es un objeto con porProyecto y hasNextPage
    expect(typeof result).toBe("object");
    expect(Array.isArray(result)).toBe(false);
    expect(Object.keys(result).sort()).toEqual(["hasNextPage", "porProyecto", "total"]);
    expect(Object.keys(result.porProyecto).sort()).toEqual(["proy-1", "proy-2"]);
    expect(result.porProyecto["proy-1"]).toHaveLength(2);
    expect(result.porProyecto["proy-2"]).toHaveLength(1);
    expect(result.porProyecto["proy-1"][0].id).toBe("ejec-1");
    expect(result.porProyecto["proy-2"][0].casoPrueba.proyecto.nombre).toBe("Proyecto Beta");
  });

  it("retorna Record vacío cuando no hay ejecuciones", async () => {
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    const result = await listEjecucionesPorProyecto();

    expect(result).toEqual({ porProyecto: {}, hasNextPage: false, total: 0 });
  });
});
