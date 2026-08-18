// __tests__/lib/ejecuciones/actions.test.ts
// Tests for HU-3 Motor de Ejecución Playwright — AC-1, AC-5, AC-6 (dispararEjecucion with lock)
//
// El contrato real de la implementación (lib/ejecuciones/actions.ts):
// - `dispararEjecucion(casoPruebaId)` recibe 1 solo argumento (no session)
// - Obtiene la sesión internamente vía `getSession()` y llama `requireSuperadmin(session)`
// - Verifica que el caso existe con `prisma.casoPrueba.findUnique`
// - Dentro de `prisma.$transaction` ejecuta `tx.$executeRaw` con FOR UPDATE NOWAIT
// - Si la transacción tiene éxito: crea Ejecucion(estado=pendiente) y retorna {id, estado}
// - Si Postgres retorna P2024 → throw YA_EXISTE_EJECUCION_EN_CURSO_ERROR (Error instance)
// - Si el caso no existe → throw NOT_FOUND_ERROR (Error instance)
// - requireSuperadmin tira FORBIDDEN_ERROR si el usuario no es superadmin
//
// Los marker errors (YA_EXISTE_EJECUCION_EN_CURSO_ERROR, FORBIDDEN_ERROR, NOT_FOUND_ERROR)
// son comparados por identidad (===) en app/api/ejecuciones/route.ts.

import { dispararEjecucion, detenerEjecucion } from "@/lib/ejecuciones/actions";
import {
  YA_EXISTE_EJECUCION_EN_CURSO_ERROR,
  EJECUCION_YA_TERMINADA_ERROR,
} from "@/lib/ejecuciones/errors";
import { FORBIDDEN_ERROR, NOT_FOUND_ERROR, getSession, requireSuperadmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    casoPrueba: {
      findUnique: jest.fn(),
    },
    ejecucion: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireSuperadmin: jest.fn(),
  FORBIDDEN_ERROR: new Error("FORBIDDEN"),
  NOT_FOUND_ERROR: new Error("NOT_FOUND"),
}));

const mockSession = { userId: "user-123", email: "admin@example.com" };

describe("dispararEjecucion — happy path (AC-1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
  });

  it("inserta Ejecucion con estado pendiente y retorna {id, estado}", async () => {
    // Arrange: caso existe, lock NOWAIT no devuelve filas (no concurrente),
    // y la transacción ejecuta el create correctamente.
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      script: 'test("pasa", async ({ page }) => {});',
      scriptFileName: "test.spec.ts",
    });
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined); // FOR UPDATE NOWAIT: no rows
    const createdEjecucion = {
      id: "ejec-1",
      casoPruebaId: "caso-1",
      estado: "pendiente",
    };
    (prisma.ejecucion.create as jest.Mock).mockResolvedValue(createdEjecucion);

    // Mockear $transaction para que invoque la callback con un tx fake
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: prisma.$executeRaw,
          ejecucion: { create: prisma.ejecucion.create },
        };
        return cb(tx);
      }
    );

    // Act
    const result = await dispararEjecucion("caso-1");

    // Assert
    expect(result).toEqual({ id: "ejec-1", estado: "pendiente" });
    expect(requireSuperadmin).toHaveBeenCalledWith(mockSession);
    expect(prisma.casoPrueba.findUnique).toHaveBeenCalledWith({
      where: { id: "caso-1" },
    });
    expect(prisma.ejecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          casoPruebaId: "caso-1",
          estado: "pendiente",
        }),
      })
    );
  });

  it("ejecuta SELECT FOR UPDATE NOWAIT dentro de la transacción", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      script: "test('pasa', async ({ page }) => {});",
      scriptFileName: "test.spec.ts",
    });
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);
    (prisma.ejecucion.create as jest.Mock).mockResolvedValue({
      id: "ejec-2",
      casoPruebaId: "caso-1",
      estado: "pendiente",
    });
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: prisma.$executeRaw,
          ejecucion: { create: prisma.ejecucion.create },
        };
        return cb(tx);
      }
    );

    await dispararEjecucion("caso-1");

    // Verificar que $executeRaw fue llamado (FOR UPDATE NOWAIT)
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

describe("dispararEjecucion — AC-5 concurrencia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
  });

  it("rechaza segunda ejecución concurrente con YA_EXISTE_EJECUCION_EN_CURSO_ERROR (P2024)", async () => {
    // Arrange: caso existe, pero el FOR UPDATE NOWAIT retorna P2024 (lock_not_available)
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      script: "test('pasa', async ({ page }) => {});",
      scriptFileName: "test.spec.ts",
    });

    const pgError = new Error("could not obtain lock on row in relation") as any;
    pgError.code = "P2024";
    (prisma.$executeRaw as jest.Mock).mockRejectedValue(pgError);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          $executeRaw: prisma.$executeRaw,
          ejecucion: { create: prisma.ejecucion.create },
        };
        return cb(tx);
      }
    );

    // Act & Assert
    await expect(dispararEjecucion("caso-1")).rejects.toBe(
      YA_EXISTE_EJECUCION_EN_CURSO_ERROR
    );
    expect(prisma.ejecucion.create).not.toHaveBeenCalled();
  });
});

describe("dispararEjecucion — casos de error", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
  });

  it("lanza NOT_FOUND_ERROR si el caso no existe", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(dispararEjecucion("caso-inexistente")).rejects.toBe(
      NOT_FOUND_ERROR
    );
    // No se llega a la transacción
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("lanza FORBIDDEN_ERROR si requireSuperadmin tira", async () => {
    (requireSuperadmin as jest.Mock).mockRejectedValue(FORBIDDEN_ERROR);

    await expect(dispararEjecucion("caso-1")).rejects.toBe(FORBIDDEN_ERROR);
    // No se llegó a chequear el caso
    expect(prisma.casoPrueba.findUnique).not.toHaveBeenCalled();
  });
});

describe("detenerEjecucion — cancelación de ejecuciones activas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireSuperadmin as jest.Mock).mockResolvedValue(undefined);
  });

  it("cancela una ejecución 'pendiente' usando updateMany con filtro atómico", async () => {
    // Arrange: updateMany afecta 1 fila (caso happy path)
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    // Act
    const result = await detenerEjecucion("ejec-1");

    // Assert
    expect(result).toEqual({ id: "ejec-1", estado: "cancelado" });
    expect(prisma.ejecucion.updateMany).toHaveBeenCalledWith({
      where: {
        id: "ejec-1",
        estado: { in: ["pendiente", "corriendo"] },
      },
      data: expect.objectContaining({
        estado: "cancelado",
        finAt: expect.any(Date),
      }),
    });
    // No se hace la verificación adicional (porque sí afectó 1 fila)
    expect(prisma.ejecucion.findUnique).not.toHaveBeenCalled();
  });

  it("cancela una ejecución 'corriendo' usando el mismo filtro atómico", async () => {
    // Misma implementación que pendiente — el filtro `in: ['pendiente', 'corriendo']`
    // cubre ambos estados. updateMany afecta 1 fila.
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await detenerEjecucion("ejec-corriendo");

    expect(result).toEqual({ id: "ejec-corriendo", estado: "cancelado" });
    expect(prisma.ejecucion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "ejec-corriendo",
          estado: { in: ["pendiente", "corriendo"] },
        }),
        data: expect.objectContaining({ estado: "cancelado" }),
      })
    );
  });

  it("lanza EJECUCION_YA_TERMINADA_ERROR si updateMany afecta 0 filas pero la ejecución existe", async () => {
    // updateMany no afecta nada porque ya está terminal, pero la fila existe
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({ id: "ejec-1" });

    await expect(detenerEjecucion("ejec-1")).rejects.toBe(
      EJECUCION_YA_TERMINADA_ERROR
    );
    expect(prisma.ejecucion.findUnique).toHaveBeenCalledWith({
      where: { id: "ejec-1" },
      select: { id: true },
    });
  });

  it("lanza NOT_FOUND_ERROR si la ejecución no existe", async () => {
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(detenerEjecucion("ejec-inexistente")).rejects.toBe(
      NOT_FOUND_ERROR
    );
  });

  it("lanza FORBIDDEN_ERROR si requireSuperadmin falla antes de tocar la BD", async () => {
    (requireSuperadmin as jest.Mock).mockRejectedValue(FORBIDDEN_ERROR);

    await expect(detenerEjecucion("ejec-1")).rejects.toBe(FORBIDDEN_ERROR);
    // No se llegó a la BD
    expect(prisma.ejecucion.updateMany).not.toHaveBeenCalled();
    expect(prisma.ejecucion.findUnique).not.toHaveBeenCalled();
  });
});
