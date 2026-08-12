// __tests__/lib/ejecuciones/actions.test.ts
// RED test — testing functionality that doesn't exist yet
// These tests verify AC-1, AC-5, AC-6 (dispararEjecucion with lock)

import { dispararEjecucion } from "@/lib/ejecuciones/actions";
import { getEjecucionConPasos, listEjecucionesPorProyecto } from "@/lib/ejecuciones/queries";
import { prisma } from "@/lib/db";
import { requireSuperadmin } from "@/lib/auth";
import type { SessionData } from "@/lib/auth";

jest.mock("@/lib/db", () => ({
  prisma: {
    ejecucion: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    casoPrueba: {
      findUnique: jest.fn(),
    },
    pasoEjecucion: {
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

describe("dispararEjecucion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("inserta Ejecucion con estado pendiente y retorna inmediatamente — AC-1", async () => {
    // Arrange
    const mockCaso = {
      id: "caso-1",
      script: 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => { await page.goto("/"); });',
      scriptFileName: "test.spec.ts",
    };
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(mockCaso);
    (prisma.ejecucion.findFirst as jest.Mock).mockResolvedValue(null); // no hay otra en curso
    (prisma.ejecucion.create as jest.Mock).mockResolvedValue({
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "pendiente",
    });

    // Act
    const result = await dispararEjecucion("caso-1", mockSession);

    // Assert
    expect(result.estado).toBe("pendiente");
    expect(result.id).toBeDefined();
    expect(prisma.ejecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ estado: "pendiente" }),
      })
    );
  });

  it("rechaza segunda ejecución para el mismo caso si hay una en curso — AC-5", async () => {
    // Arrange
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      script: "test('pasa', async ({ page }) => {});",
      scriptFileName: "test.spec.ts",
    });
    (prisma.ejecucion.findFirst as jest.Mock).mockResolvedValue({
      id: "ejec-anterior",
      estado: "corriendo",
    });

    // Act & Assert
    await expect(dispararEjecucion("caso-1", mockSession)).rejects.toEqual({
      status: 409,
      body: {
        error: "conflict",
        message: "Ya existe una ejecución en curso para este caso",
      },
    });
  });

  it("permite nueva ejecución tras finish — AC-6", async () => {
    // Arrange: previous execution is in terminal state (paso)
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      script: "test('pasa', async ({ page }) => {});",
      scriptFileName: "test.spec.ts",
    });
    (prisma.ejecucion.findFirst as jest.Mock).mockResolvedValue(null); // no running execution
    (prisma.ejecucion.create as jest.Mock).mockResolvedValue({
      id: "ejec-nueva",
      casoPruebaId: "caso-1",
      estado: "pendiente",
    });

    // Act
    const result = await dispararEjecucion("caso-1", mockSession);

    // Assert
    expect(result.estado).toBe("pendiente");
    expect(prisma.ejecucion.create).toHaveBeenCalled();
  });

  it("lanza 404 si el caso no existe — AC-1", async () => {
    // Arrange
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(null);

    // Act & Assert
    await expect(dispararEjecucion("caso-inexistente", mockSession)).rejects.toEqual({
      status: 404,
      body: { error: "not_found" },
    });
  });

  it("lanza 403 si el usuario no es superadmin — AC-1", async () => {
    // Arrange
    (prisma.usuario.findUnique as jest.Mock).mockResolvedValue({ id: "user-123", rol: "usuario" });

    // Act & Assert
    await expect(dispararEjecucion("caso-1", mockSession)).rejects.toEqual({
      status: 403,
      body: { error: "forbidden", message: "superadmin required" },
    });
  });
});

describe("getEjecucionConPasos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna ejecución con pasos ordenados por número — AC-11", async () => {
    // Arrange
    const mockEjecucion = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "corriendo",
      inicioAt: new Date(),
      finAt: null,
      duracionMs: null,
      errorMsg: null,
      casoPrueba: { id: "caso-1", nombre: "Caso Test", codigo: "CP-01", proyectoId: "proyecto-1" },
      pasos: [
        { id: "paso-2", numero: 2, descripcion: "Segundo paso", estado: "paso", duracionMs: 500 },
        { id: "paso-1", numero: 1, descripcion: "Primer paso", estado: "paso", duracionMs: 300 },
      ],
    };
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(mockEjecucion);

    // Act
    const result = await getEjecucionConPasos("ejec-1");

    // Assert
    expect(result).toBeDefined();
    expect(result!.pasos).toHaveLength(2);
    // Verify ordering: step 1 should come before step 2
    expect(result!.pasos[0].numero).toBe(1);
    expect(result!.pasos[1].numero).toBe(2);
  });

  it("retorna null cuando la ejecución no existe — AC-11", async () => {
    // Arrange
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(null);

    // Act
    const result = await getEjecucionConPasos("ejec-inexistente");

    // Assert
    expect(result).toBeNull();
  });
});

describe("listEjecucionesPorProyecto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("agrupa ejecuciones por proyecto — AC-4", async () => {
    // Arrange
    const mockEjecuciones = [
      {
        id: "ejec-1",
        estado: "paso",
        casoPrueba: {
          id: "caso-1",
          nombre: "Caso A",
          codigo: "CP-A",
          proyecto: { id: "proy-1", nombre: "Proyecto Alpha" },
        },
        pasos: [],
      },
      {
        id: "ejec-2",
        estado: "fallo",
        casoPrueba: {
          id: "caso-2",
          nombre: "Caso B",
          codigo: "CP-B",
          proyecto: { id: "proy-1", nombre: "Proyecto Alpha" },
        },
        pasos: [],
      },
      {
        id: "ejec-3",
        estado: "pendiente",
        casoPrueba: {
          id: "caso-3",
          nombre: "Caso C",
          codigo: "CP-C",
          proyecto: { id: "proy-2", nombre: "Proyecto Beta" },
        },
        pasos: [],
      },
    ];
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue(mockEjecuciones);

    // Act
    const result = await listEjecucionesPorProyecto();

    // Assert
    expect(result).toBeDefined();
    expect(result).toHaveLength(3);
    // Verify project grouping is possible via the nested proyecto data
    expect(result[0].casoPrueba.proyecto.nombre).toBe("Proyecto Alpha");
    expect(result[2].casoPrueba.proyecto.nombre).toBe("Proyecto Beta");
  });

  it("retorna array vacío cuando no hay ejecuciones — AC-4", async () => {
    // Arrange
    (prisma.ejecucion.findMany as jest.Mock).mockResolvedValue([]);

    // Act
    const result = await listEjecucionesPorProyecto();

    // Assert
    expect(result).toEqual([]);
  });
});
