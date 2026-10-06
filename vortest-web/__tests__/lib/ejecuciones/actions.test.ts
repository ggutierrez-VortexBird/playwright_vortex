// __tests__/lib/ejecuciones/actions.test.ts
// Tests for HU-3 Motor de Ejecución Playwright — AC-1, AC-5, AC-6
// (dispararEjecucion with lock) + Motor Fase 1 (RabbitMQ dispatch).
//
// El contrato real de la implementación (lib/ejecuciones/actions.ts):
// - `dispararEjecucion(casoPruebaId)` recibe 1 solo argumento (no session)
// - Obtiene la sesión internamente vía `getSession()` y llama `requireProyectoAccess(session, proyectoId)`
// - Verifica que el caso existe con `prisma.casoPrueba.findUnique` (con `include: { parentCase: true }`)
// - Dentro de `prisma.$transaction` ejecuta `tx.$executeRaw` con FOR UPDATE NOWAIT (SIN CAMBIOS)
// - Si la transacción tiene éxito: crea Ejecucion(estado=pendiente), la pasa a
//   'corriendo' (mismo punto donde antes el worker viejo la "tomaba"), y
//   publica su job a RabbitMQ (o el del caso padre, si hay encadenamiento)
// - Si Postgres retorna P2024 → throw YA_EXISTE_EJECUCION_EN_CURSO_ERROR (Error instance)
// - Si el caso no existe → throw NOT_FOUND_ERROR (Error instance)
// - requireProyectoAccess tira FORBIDDEN_ERROR si el usuario no tiene acceso
//
// Los marker errors (YA_EXISTE_EJECUCION_EN_CURSO_ERROR, FORBIDDEN_ERROR, NOT_FOUND_ERROR)
// son comparados por identidad (===).

import { dispararEjecucion, detenerEjecucion } from "@/lib/ejecuciones/actions";
import {
  YA_EXISTE_EJECUCION_EN_CURSO_ERROR,
  EJECUCION_YA_TERMINADA_ERROR,
} from "@/lib/ejecuciones/errors";
import { FORBIDDEN_ERROR, NOT_FOUND_ERROR, getSession, requireProyectoAccess } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publishExecuteJob } from "@/lib/queue/rabbitmq";

jest.mock("@/lib/db", () => ({
  prisma: {
    casoPrueba: {
      findUnique: jest.fn(),
    },
    ejecucion: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
    $executeRaw: jest.fn(),
  },
}));

jest.mock("@/lib/auth", () => ({
  getSession: jest.fn(),
  requireProyectoAccess: jest.fn(),
  FORBIDDEN_ERROR: new Error("FORBIDDEN"),
  NOT_FOUND_ERROR: new Error("NOT_FOUND"),
}));

jest.mock("@/lib/queue/rabbitmq", () => {
  return {
    publishExecuteJob: jest.fn<() => Promise<void>>(),
  };
});

const mockSession = { userId: "user-123", email: "admin@example.com" };

function mockTransaction() {
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw: prisma.$executeRaw,
        ejecucion: { create: prisma.ejecucion.create },
      };
      return cb(tx);
    }
  );
}

describe("dispararEjecucion — happy path (AC-1), sin encadenamiento padre/hijo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
    (prisma.ejecucion.update as jest.Mock).mockResolvedValue({});
    (publishExecuteJob as jest.Mock).mockResolvedValue(undefined);
  });

  it("inserta Ejecucion pendiente, la pasa a corriendo, publica el job y retorna {id, estado:'corriendo'}", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
      parentCaseId: null,
      parentCase: null,
      script: 'test("pasa", async ({ page }) => {});',
      scriptFileName: "test.spec.ts",
      sesiones: [],
    });
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined); // FOR UPDATE NOWAIT: no rows
    const createdEjecucion = { id: "ejec-1", casoPruebaId: "caso-1", estado: "pendiente" };
    (prisma.ejecucion.create as jest.Mock).mockResolvedValue(createdEjecucion);
    mockTransaction();

    const result = await dispararEjecucion("caso-1");

    expect(result).toEqual({ id: "ejec-1", estado: "corriendo" });
    expect(requireProyectoAccess).toHaveBeenCalledWith(mockSession, "proyecto-1");
    expect(prisma.casoPrueba.findUnique).toHaveBeenCalledWith({
      where: { id: "caso-1" },
      include: { parentCase: true, sesiones: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    expect(prisma.ejecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ casoPruebaId: "caso-1", estado: "pendiente" }),
      })
    );
    // Transición a 'corriendo' apenas se publica — mismo punto donde antes
    // tryClaimPendingExecution del worker viejo tomaba el trabajo.
    expect(prisma.ejecucion.update).toHaveBeenCalledWith({
      where: { id: "ejec-1" },
      data: { estado: "corriendo", inicioAt: expect.any(Date) },
    });
    expect(publishExecuteJob).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "ejec-1",
        scriptFileName: "test.spec.ts",
        inputStorageState: undefined,
        timeoutMs: expect.any(Number),
      })
    );
    // scriptText = script + hook de storageState
    const publishedJob = (publishExecuteJob as jest.Mock).mock.calls[0][0];
    expect(publishedJob.scriptText).toContain('test("pasa"');
    expect(publishedJob.scriptText).toContain("PLAYWRIGHT_STORAGE_STATE_OUTPUT");
  });

  it("ejecuta SELECT FOR UPDATE NOWAIT dentro de la transacción", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
      parentCaseId: null,
      parentCase: null,
      script: "test('pasa', async ({ page }) => {});",
      scriptFileName: "test.spec.ts",
    });
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);
    (prisma.ejecucion.create as jest.Mock).mockResolvedValue({
      id: "ejec-2",
      casoPruebaId: "caso-1",
      estado: "pendiente",
    });
    mockTransaction();

    await dispararEjecucion("caso-1");

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("si publicar el job falla, marca la Ejecucion como errorMotor sin lanzar", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
      parentCaseId: null,
      parentCase: null,
      script: "test('pasa');",
      scriptFileName: "test.spec.ts",
      sesiones: [],
    });
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);
    (prisma.ejecucion.create as jest.Mock).mockResolvedValue({
      id: "ejec-3",
      casoPruebaId: "caso-1",
      estado: "pendiente",
    });
    mockTransaction();
    (publishExecuteJob as jest.Mock).mockImplementation(() => Promise.reject(new Error("RabbitMQ caído")));

    const result = await dispararEjecucion("caso-1");

    expect(result).toEqual({ id: "ejec-3", estado: "errorMotor" });
    // Last call is the errorMotor update (after publishExecuteJob failed).
    // First call was to transition to 'corriendo' before publishing.
    expect(prisma.ejecucion.update).toHaveBeenLastCalledWith({
      where: { id: "ejec-3" },
      data: expect.objectContaining({
        estado: "errorMotor",
        errorMsg: expect.stringContaining("RabbitMQ caído"),
      }),
    });
  });
});

describe("dispararEjecucion — encadenamiento padre/hijo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
    (prisma.ejecucion.update as jest.Mock).mockResolvedValue({});
    (publishExecuteJob as jest.Mock).mockResolvedValue(undefined);
  });

  it("publica el job del PADRE (no el del hijo) y deja pendingChildEjecucionId apuntando al hijo", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-hijo",
      proyectoId: "proyecto-1",
      parentCaseId: "caso-padre",
      parentCase: { id: "caso-padre", script: "test('padre');", scriptFileName: "padre.spec.ts" },
      script: "test('hijo');",
      scriptFileName: "hijo.spec.ts",
      sesiones: [],
    });
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);
    (prisma.ejecucion.create as jest.Mock)
      .mockResolvedValueOnce({ id: "ejec-hijo", casoPruebaId: "caso-hijo", estado: "pendiente" })
      // Segunda llamada a ejecucion.create: la fila sintetizada del padre
      // (esta la hace dispararEjecucion directamente, fuera del $transaction).
      .mockResolvedValueOnce({ id: "ejec-padre", casoPruebaId: "caso-padre", estado: "corriendo" });
    mockTransaction();

    const result = await dispararEjecucion("caso-hijo");

    expect(result).toEqual({ id: "ejec-hijo", estado: "corriendo" });

    // La fila del padre se crea con pendingChildEjecucionId = hijo.id
    expect(prisma.ejecucion.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        casoPruebaId: "caso-padre",
        estado: "corriendo",
        pendingChildEjecucionId: "ejec-hijo",
      }),
    });

    // Se publica el job del PADRE, no el del hijo.
    expect(publishExecuteJob).toHaveBeenCalledTimes(1);
    const publishedJob = (publishExecuteJob as jest.Mock).mock.calls[0][0];
    expect(publishedJob.jobId).toBe("ejec-padre");
    expect(publishedJob.scriptText).toContain("test('padre')");
  });
});

describe("dispararEjecucion — AC-5 concurrencia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
  });

  it("rechaza segunda ejecución concurrente con YA_EXISTE_EJECUCION_EN_CURSO_ERROR (P2024)", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
      parentCaseId: null,
      parentCase: null,
      script: "test('pasa', async ({ page }) => {});",
      scriptFileName: "test.spec.ts",
    });

    const pgError = new Error("could not obtain lock on row in relation") as any;
    pgError.code = "P2024";
    (prisma.$executeRaw as jest.Mock).mockRejectedValue(pgError);
    mockTransaction();

    await expect(dispararEjecucion("caso-1")).rejects.toBe(YA_EXISTE_EJECUCION_EN_CURSO_ERROR);
    expect(prisma.ejecucion.create).not.toHaveBeenCalled();
    expect(publishExecuteJob).not.toHaveBeenCalled();
  });
});

describe("dispararEjecucion — casos de error", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
  });

  it("lanza NOT_FOUND_ERROR si el caso no existe", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(dispararEjecucion("caso-inexistente")).rejects.toBe(NOT_FOUND_ERROR);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(requireProyectoAccess).not.toHaveBeenCalled();
  });

  it("lanza FORBIDDEN_ERROR si requireProyectoAccess tira", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
    });
    (requireProyectoAccess as jest.Mock).mockRejectedValue(FORBIDDEN_ERROR);

    await expect(dispararEjecucion("caso-1")).rejects.toBe(FORBIDDEN_ERROR);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("detenerEjecucion — cancelación de ejecuciones activas", () => {
  const originalFetch = global.fetch;
  const originalEngineUrl = process.env.ENGINE_INTERNAL_URL;
  const originalEngineSecret = process.env.ENGINE_INTERNAL_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
    process.env.ENGINE_INTERNAL_URL = "http://engine:3001";
    process.env.ENGINE_INTERNAL_SECRET = "test-secret";
    global.fetch = jest.fn().mockResolvedValue({ status: 200 });
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.ENGINE_INTERNAL_URL = originalEngineUrl;
    process.env.ENGINE_INTERNAL_SECRET = originalEngineSecret;
  });

  it("cancela una ejecución 'pendiente' y notifica al motor con X-Internal-Secret", async () => {
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({
      casoPrueba: { proyectoId: "proyecto-1" },
      pendingChildEjecucionId: null,
    });
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await detenerEjecucion("ejec-1");

    expect(result).toEqual({ id: "ejec-1", estado: "cancelado" });
    expect(requireProyectoAccess).toHaveBeenCalledWith(mockSession, "proyecto-1");
    expect(prisma.ejecucion.updateMany).toHaveBeenCalledWith({
      where: { id: "ejec-1", estado: { in: ["pendiente", "corriendo"] } },
      data: expect.objectContaining({ estado: "cancelado", finAt: expect.any(Date) }),
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://engine:3001/internal/cancel/ejec-1",
      expect.objectContaining({
        method: "POST",
        headers: { "X-Internal-Secret": "test-secret" },
      })
    );
  });

  it("trata 404 del motor como éxito benigno (otra réplica tenía el job)", async () => {
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({
      casoPrueba: { proyectoId: "proyecto-1" },
      pendingChildEjecucionId: null,
    });
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (global.fetch as jest.Mock).mockResolvedValue({ status: 404 });

    await expect(detenerEjecucion("ejec-1")).resolves.toEqual({ id: "ejec-1", estado: "cancelado" });
  });

  it("un error de red al notificar al motor NO hace fallar la cancelación", async () => {
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({
      casoPrueba: { proyectoId: "proyecto-1" },
      pendingChildEjecucionId: null,
    });
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (global.fetch as jest.Mock).mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(detenerEjecucion("ejec-1")).resolves.toEqual({ id: "ejec-1", estado: "cancelado" });
  });

  it("propaga la cancelación a un hijo pendiente (padre cancelado en encadenamiento)", async () => {
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({
      casoPrueba: { proyectoId: "proyecto-1" },
      pendingChildEjecucionId: "ejec-hijo",
    });
    (prisma.ejecucion.updateMany as jest.Mock)
      .mockResolvedValueOnce({ count: 1 }) // cancelación del propio padre
      .mockResolvedValueOnce({ count: 1 }); // cascada al hijo

    await detenerEjecucion("ejec-padre");

    expect(prisma.ejecucion.updateMany).toHaveBeenNthCalledWith(2, {
      where: { id: "ejec-hijo", estado: { in: ["pendiente", "corriendo"] } },
      data: expect.objectContaining({ estado: "errorMotor", finAt: expect.any(Date) }),
    });
  });

  it("cancela una ejecución 'corriendo' usando el mismo filtro atómico", async () => {
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({
      casoPrueba: { proyectoId: "proyecto-1" },
      pendingChildEjecucionId: null,
    });
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const result = await detenerEjecucion("ejec-corriendo");

    expect(result).toEqual({ id: "ejec-corriendo", estado: "cancelado" });
    expect(prisma.ejecucion.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "ejec-corriendo", estado: { in: ["pendiente", "corriendo"] } }),
        data: expect.objectContaining({ estado: "cancelado" }),
      })
    );
  });

  it("lanza EJECUCION_YA_TERMINADA_ERROR si updateMany afecta 0 filas pero la ejecución existe", async () => {
    (prisma.ejecucion.findUnique as jest.Mock)
      .mockResolvedValueOnce({ casoPrueba: { proyectoId: "proyecto-1" }, pendingChildEjecucionId: null })
      .mockResolvedValueOnce({ id: "ejec-1" });
    (prisma.ejecucion.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    await expect(detenerEjecucion("ejec-1")).rejects.toBe(EJECUCION_YA_TERMINADA_ERROR);
    expect(prisma.ejecucion.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: "ejec-1" },
      select: { id: true },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("lanza NOT_FOUND_ERROR si la ejecución no existe", async () => {
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(detenerEjecucion("ejec-inexistente")).rejects.toBe(NOT_FOUND_ERROR);
    expect(prisma.ejecucion.updateMany).not.toHaveBeenCalled();
  });

  it("lanza FORBIDDEN_ERROR si requireProyectoAccess falla", async () => {
    (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({
      casoPrueba: { proyectoId: "proyecto-1" },
      pendingChildEjecucionId: null,
    });
    (requireProyectoAccess as jest.Mock).mockRejectedValue(FORBIDDEN_ERROR);

    await expect(detenerEjecucion("ejec-1")).rejects.toBe(FORBIDDEN_ERROR);
    expect(prisma.ejecucion.updateMany).not.toHaveBeenCalled();
  });
});
