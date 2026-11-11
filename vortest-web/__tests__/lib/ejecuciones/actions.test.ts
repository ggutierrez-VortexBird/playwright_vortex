// dispararEjecucion: lock por caso, creación de la Ejecucion y publicación del job a RabbitMQ.

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
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    sesionGrabacion: {
      findFirst: jest.fn().mockResolvedValue(null),
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
    publishExecuteJob: jest.fn(),
  };
});

const mockSession = { userId: "user-123", email: "admin@example.com" };

function mockTransaction() {
  (prisma.ejecucion.count as jest.Mock).mockResolvedValue(0);
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $executeRaw: prisma.$executeRaw,
        ejecucion: { create: prisma.ejecucion.create, count: prisma.ejecucion.count },
      };
      return cb(tx);
    }
  );
}

describe("dispararEjecucion — happy path, sin encadenamiento padre/hijo", () => {
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
    (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined); // pg_advisory_xact_lock
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
    // Pasa a 'corriendo' apenas se publica el job
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

  it("toma un lock por caso y cuenta las ejecuciones en curso dentro de la transacción", async () => {
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
    expect(prisma.ejecucion.count).toHaveBeenCalledWith({
      where: { casoPruebaId: "caso-1", estado: { in: ["pendiente", "corriendo"] } },
    });
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
    // La última llamada es el update a errorMotor, tras fallar publishExecuteJob.
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
      // Segunda ejecucion.create: fila sintetizada del padre, fuera del $transaction.
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

describe("dispararEjecucion concurrencia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue(mockSession);
    (requireProyectoAccess as jest.Mock).mockResolvedValue(undefined);
  });

  it("rechaza una ejecución si el caso ya tiene una en curso (YA_EXISTE_EJECUCION_EN_CURSO_ERROR)", async () => {
    (prisma.casoPrueba.findUnique as jest.Mock).mockResolvedValue({
      id: "caso-1",
      proyectoId: "proyecto-1",
      parentCaseId: null,
      parentCase: null,
      script: "test('pasa', async ({ page }) => {});",
      scriptFileName: "test.spec.ts",
    });

    (prisma.$executeRaw as jest.Mock).mockResolvedValue(undefined);
    mockTransaction();
    (prisma.ejecucion.count as jest.Mock).mockResolvedValue(1);

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
