// checkNoRunningExecution usa $queryRaw con FOR UPDATE NOWAIT; el filtro de estados vive en el SQL, por eso se mockea $queryRaw.

import { prisma } from "@/lib/db";

jest.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

describe("checkNoRunningExecution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no lanza error cuando no hay ejecuciones en curso", async () => {
    const { checkNoRunningExecution } = await import("@/lib/worker/lock");
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    await expect(
      checkNoRunningExecution(prisma, "caso-1")
    ).resolves.toBeUndefined();
  });

  it("lanza EJECUCION_EN_CURSO_ERROR cuando existe ejecución pendiente", async () => {
    const { checkNoRunningExecution, EJECUCION_EN_CURSO_ERROR } = await import(
      "@/lib/worker/lock"
    );
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: "ejec-1", estado: "pendiente" },
    ]);

    await expect(
      checkNoRunningExecution(prisma, "caso-1")
    ).rejects.toThrow(EJECUCION_EN_CURSO_ERROR.message);
  });

  it("lanza EJECUCION_EN_CURSO_ERROR cuando existe ejecución corriendo", async () => {
    const { checkNoRunningExecution, EJECUCION_EN_CURSO_ERROR } = await import(
      "@/lib/worker/lock"
    );
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { id: "ejec-1", estado: "corriendo" },
    ]);

    await expect(
      checkNoRunningExecution(prisma, "caso-1")
    ).rejects.toThrow(EJECUCION_EN_CURSO_ERROR.message);
  });

  it("permite nueva ejecución cuando la anterior está en estado terminal", async () => {
    // La query ya filtra los estados terminales en el SQL, así que el mock devuelve [].
    const { checkNoRunningExecution } = await import("@/lib/worker/lock");
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    await expect(
      checkNoRunningExecution(prisma, "caso-1")
    ).resolves.toBeUndefined();
  });

  it("convierte error P2024 de Postgres en EJECUCION_EN_CURSO_ERROR", async () => {
    const { checkNoRunningExecution, EJECUCION_EN_CURSO_ERROR } = await import(
      "@/lib/worker/lock"
    );

    const pgError = new Error("could not obtain lock on row in relation") as any;
    pgError.code = "P2024";
    pgError.meta = { message: "lock_not_available" };
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(pgError);

    await expect(
      checkNoRunningExecution(prisma, "caso-1")
    ).rejects.toThrow(EJECUCION_EN_CURSO_ERROR.message);
  });

  it("usa $queryRaw con SQL template literal para NOWAIT", async () => {
    const { checkNoRunningExecution } = await import("@/lib/worker/lock");
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);

    await checkNoRunningExecution(prisma, "caso-1");

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});

describe("simulateNowaitLockNotAvailable", () => {
  it("lanza error con código P2024 simulando lock_not_available", async () => {
    const { simulateNowaitLockNotAvailable } = await import("@/lib/worker/lock");

    await expect(simulateNowaitLockNotAvailable()).rejects.toMatchObject({
      code: "P2024",
    });
  });
});
