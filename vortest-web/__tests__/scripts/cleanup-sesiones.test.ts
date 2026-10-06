// __tests__/scripts/cleanup-sesiones.test.ts
// HU-GR-1 — tests para el cron de limpieza de sesiones antiguas.

const mockCount = jest.fn();
const mockDeleteMany = jest.fn();
const mockDisconnect = jest.fn();

jest.mock("../../lib/db", () => ({
  prisma: {
    sesionGrabacion: {
      count: (...args: unknown[]) => mockCount(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
    $disconnect: (...args: unknown[]) => mockDisconnect(...args),
  },
}));

const mockExit = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);

// Mock console para no contaminar el output del runner de tests
const mockLog = jest.spyOn(console, "log").mockImplementation(() => undefined);
const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("scripts/cleanup-sesiones.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SESIONES_RETENTION_DAYS;
  });

  it("no hace nada si no hay sesiones a purgar", async () => {
    mockCount.mockResolvedValue(0);

    // Importamos dinámicamente para que el mock de prisma esté listo
    jest.isolateModules(() => {
      require("../../scripts/cleanup-sesiones");
    });

    await flush();

    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("purga sesiones en estado 'descartada'/'guardada' con cutoff correcto (default 7d)", async () => {
    mockCount.mockResolvedValue(3);
    mockDeleteMany.mockResolvedValue({ count: 3 });

    jest.isolateModules(() => {
      require("../../scripts/cleanup-sesiones");
    });

    await flush();

    expect(mockCount).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);

    const whereArg = mockDeleteMany.mock.calls[0][0].where;
    expect(whereArg.estado).toEqual({ in: ["descartada", "guardada"] });
    expect(whereArg.updatedAt.lt).toBeInstanceOf(Date);

    // cutoff debería ser ~7 días atrás
    const expected = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const actual = whereArg.updatedAt.lt.getTime();
    expect(Math.abs(actual - expected)).toBeLessThan(5000);

    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("respeta SESIONES_RETENTION_DAYS cuando está definido", async () => {
    process.env.SESIONES_RETENTION_DAYS = "30";
    mockCount.mockResolvedValue(0);

    jest.isolateModules(() => {
      require("../../scripts/cleanup-sesiones");
    });

    await flush();

    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringMatching(/Purga completada|Nada que purgar/),
    );
  });

  it("usa default 7 si SESIONES_RETENTION_DAYS es inválido", async () => {
    process.env.SESIONES_RETENTION_DAYS = "no-es-numero";
    mockCount.mockResolvedValue(0);

    jest.isolateModules(() => {
      require("../../scripts/cleanup-sesiones");
    });

    await flush();

    expect(mockWarn).toHaveBeenCalledWith(
      expect.stringMatching(/SESIONES_RETENTION_DAYS inválido/),
    );
  });

  it("sale con código 1 si prisma lanza error", async () => {
    mockCount.mockRejectedValue(new Error("connection refused"));

    jest.isolateModules(() => {
      require("../../scripts/cleanup-sesiones");
    });

    await flush();

    expect(mockDisconnect).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});