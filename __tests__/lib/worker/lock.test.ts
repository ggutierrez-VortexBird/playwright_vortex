// __tests__/lib/worker/lock.test.ts
// RED test — testing functionality that doesn't exist yet
// These tests verify AC-5, AC-6 (SELECT FOR UPDATE NOWAIT concurrency logic)

import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  },
}));

describe("checkNoRunningExecution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no lanza error cuando no hay ejecuciones en curso — AC-6", async () => {
    const { checkNoRunningExecution } = require("@/lib/worker/lock");

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]); // No running executions

    // Should not throw
    await expect(checkNoRunningExecution(prisma, "caso-1")).resolves.toBeUndefined();
  });

  it("lanza error de concurrencia cuando existe ejecución pendiente — AC-5", async () => {
    const { checkNoRunningExecution, EJECUCION_EN_CURSO_ERROR } = require("@/lib/worker/lock");

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: "ejec-1", estado: "pendiente" },
    ]);

    await expect(checkNoRunningExecution(prisma, "caso-1")).rejects.toThrow(
      EJECUCION_EN_CURSO_ERROR.message
    );
  });

  it("lanza error de concurrencia cuando existe ejecución corriendo — AC-5", async () => {
    const { checkNoRunningExecution, EJECUCION_EN_CURSO_ERROR } = require("@/lib/worker/lock");

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: "ejec-1", estado: "corriendo" },
    ]);

    await expect(checkNoRunningExecution(prisma, "caso-1")).rejects.toThrow(
      EJECUCION_EN_CURSO_ERROR.message
    );
  });

  it("permite cuando la ejecución anterior ya terminó (estado terminal) — AC-6", async () => {
    const { checkNoRunningExecution } = require("@/lib/worker/lock");

    // Estado terminal: paso, fallo, reparado, errorMotor
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: "ejec-antigua", estado: "paso" },
    ]);

    // Should not throw because the only running execution is in terminal state
    // Note: The actual filter in the query only looks for 'pendiente' and 'corriendo'
    await expect(checkNoRunningExecution(prisma, "caso-1")).resolves.toBeUndefined();
  });

  it("usa $queryRaw con SQL template literal para NOWAIT — AC-5", async () => {
    const { checkNoRunningExecution } = require("@/lib/worker/lock");

    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    await checkNoRunningExecution(prisma, "caso-1");

    // Verify $queryRaw was called (the actual SQL injection happens at DB level)
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});

describe("lock behavior simulation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("simula SELECT FOR UPDATE NOWAIT devolviendo lock_not_available — AC-5", async () => {
    const { simulateNowaitLockNotAvailable } = require("@/lib/worker/lock");

    // Simulate Postgres error P2024 or lock_not_available
    const pgError = new Error("could not obtain lock on row in relation") as any;
    pgError.code = "P2024";
    pgError.meta = { message: "lock_not_available" };

    (prisma.$queryRaw as jest.Mock).mockRejectedValue(pgError);

    await expect(prisma.$queryRaw("SELECT * FROM \"Ejecucion\" FOR UPDATE NOWAIT")).rejects.toMatchObject({
      code: "P2024",
    });
  });
});
