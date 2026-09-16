import { runCaseExecution, persistExecutionResult } from "@/lib/worker/execute-case";
import { validateScript } from "@/lib/worker/validate-script";
import { writeTempScript, cleanupTempScript } from "@/lib/worker/script-temp";
import { runPlaywrightTest, EjecucionCanceladaError } from "@/lib/worker/runner";
import { collectArtifacts } from "@/lib/worker/artifacts";
import { prisma } from "@/lib/db";

jest.mock("@/lib/worker/validate-script");
jest.mock("@/lib/worker/script-temp");
jest.mock("@/lib/worker/runner");
jest.mock("@/lib/worker/artifacts");
jest.mock("@/lib/db", () => ({
  prisma: {
    ejecucion: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pasoEjecucion: {
      findMany: jest.fn(),
    },
  },
}));

const mockedValidate = validateScript as jest.Mock;
const mockedWriteTemp = writeTempScript as jest.Mock;
const mockedCleanup = cleanupTempScript as jest.Mock;
const mockedRun = runPlaywrightTest as jest.Mock;
const mockedCollect = collectArtifacts as jest.Mock;

const baseCaso = {
  id: "caso-1",
  codigo: "CP-1",
  nombre: "Caso",
  script: "test('x', async ({page}) => { await page.goto('...'); });",
  scriptFileName: "test.spec.ts",
  proyectoId: "proy-1",
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("lib/worker/execute-case", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedWriteTemp.mockResolvedValue("/tmp/x.spec.ts");
    mockedCleanup.mockResolvedValue(undefined);
    mockedCollect.mockResolvedValue(undefined);
  });

  describe("runCaseExecution", () => {
    it("retorna errorMotor si la validación del script falla", async () => {
      mockedValidate.mockReturnValue({ valid: false, error: "Script inválido" });

      const result = await runCaseExecution("ejec-1", baseCaso as any);

      expect(result.finalEstado).toBe("errorMotor");
      expect(result.errorMsg).toBe("Script inválido");
      expect(mockedRun).not.toHaveBeenCalled();
    });

    it("retorna cancelado si el runner lanza EjecucionCanceladaError", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockRejectedValue(new EjecucionCanceladaError("cancelada"));

      const result = await runCaseExecution("ejec-1", baseCaso as any);

      expect(result.finalEstado).toBe("cancelado");
      expect(mockedCleanup).toHaveBeenCalled();
    });

    it("retorna errorMotor si el runner lanza un error genérico", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockRejectedValue(new Error("Playwright crashed"));

      const result = await runCaseExecution("ejec-1", baseCaso as any);

      expect(result.finalEstado).toBe("errorMotor");
      expect(result.errorMsg).toBe("Playwright crashed");
      expect(mockedCleanup).toHaveBeenCalled();
    });

    it("retorna errorMotor si no se generaron pasos (script vacío o error silencioso)", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockResolvedValue({
        durationMs: 1000,
        outputStorageState: undefined,
        outputDir: "/tmp/output",
      });
      (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([]);

      const result = await runCaseExecution("ejec-1", baseCaso as any);

      expect(result.finalEstado).toBe("errorMotor");
      expect(result.errorMsg).toContain("La ejecución no generó pasos");
    });

    it("retorna 'fallo' si hay algún paso con fallo sin selfHeal", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockResolvedValue({
        durationMs: 1000,
        outputStorageState: undefined,
        outputDir: "/tmp/output",
      });
      (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
        { id: "p1", estado: "paso", selfHealed: false },
        { id: "p2", estado: "fallo", selfHealed: false },
      ]);

      const result = await runCaseExecution("ejec-1", baseCaso as any);

      expect(result.finalEstado).toBe("fallo");
      expect(mockedCollect).toHaveBeenCalledWith("ejec-1", "/tmp/output");
    });

    it("retorna 'paso' si hay un fallo pero está selfHealed", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockResolvedValue({
        durationMs: 1000,
        outputStorageState: undefined,
        outputDir: "/tmp/output",
      });
      (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
        { id: "p1", estado: "fallo", selfHealed: true },
      ]);

      const result = await runCaseExecution("ejec-1", baseCaso as any);

      expect(result.finalEstado).toBe("paso");
    });

    it("retorna 'paso' si todos los pasos pasaron", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockResolvedValue({
        durationMs: 1500,
        outputStorageState: { cookies: [] },
        outputDir: "/tmp/output",
      });
      (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
        { id: "p1", estado: "paso", selfHealed: false },
        { id: "p2", estado: "paso", selfHealed: false },
      ]);

      const result = await runCaseExecution("ejec-1", baseCaso as any);

      expect(result.finalEstado).toBe("paso");
      expect(result.durationMs).toBe(1500);
      expect(result.outputStorageState).toEqual({ cookies: [] });
    });

    it("continúa aunque collectArtifacts falle (no propaga el error)", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockResolvedValue({
        durationMs: 1000,
        outputStorageState: undefined,
        outputDir: "/tmp/output",
      });
      mockedCollect.mockRejectedValue(new Error("disk full"));
      (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
        { id: "p1", estado: "paso", selfHealed: false },
      ]);

      // espía console.error para que el test no imprima ruido
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const result = await runCaseExecution("ejec-1", baseCaso as any);

      expect(result.finalEstado).toBe("paso");
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it("llama a cleanupTempScript en finally", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockResolvedValue({
        durationMs: 1000,
        outputStorageState: undefined,
        outputDir: "/tmp/output",
      });
      (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
        { id: "p1", estado: "paso", selfHealed: false },
      ]);

      await runCaseExecution("ejec-1", baseCaso as any);

      expect(mockedCleanup).toHaveBeenCalledWith("/tmp/x.spec.ts");
    });

    it("respeta inputStorageState (caso padre)", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      mockedRun.mockResolvedValue({
        durationMs: 1000,
        outputStorageState: undefined,
        outputDir: "/tmp/output",
      });
      (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
        { id: "p1", estado: "paso", selfHealed: false },
      ]);

      const parentState = { cookies: [{ name: "session", value: "abc" }] };

      await runCaseExecution("ejec-1", baseCaso as any, {
        inputStorageState: parentState,
      });

      expect(mockedRun).toHaveBeenCalledWith(
        "/tmp/x.spec.ts",
        "ejec-1",
        expect.objectContaining({ inputStorageState: parentState }),
      );
    });

    it("isAborted consulta el estado actual de la ejecución", async () => {
      mockedValidate.mockReturnValue({ valid: true });
      let capturedAbort: (() => Promise<boolean>) | undefined;
      mockedRun.mockImplementation(async (_path, _id, opts) => {
        capturedAbort = opts.isAborted;
        return {
          durationMs: 1000,
          outputStorageState: undefined,
          outputDir: "/tmp/output",
        };
      });
      (prisma.pasoEjecucion.findMany as jest.Mock).mockResolvedValue([
        { id: "p1", estado: "paso", selfHealed: false },
      ]);
      (prisma.ejecucion.findUnique as jest.Mock).mockResolvedValue({
        estado: "cancelado",
      });

      await runCaseExecution("ejec-1", baseCaso as any);

      expect(capturedAbort).toBeDefined();
      const result = await capturedAbort!();
      expect(result).toBe(true);
    });
  });

  describe("persistExecutionResult", () => {
    it("actualiza la ejecución con el resultado", async () => {
      (prisma.ejecucion.update as jest.Mock).mockResolvedValue({});

      await persistExecutionResult("ejec-1", {
        finalEstado: "paso",
        durationMs: 1500,
      });

      // Sin outputStorageState, la implementación persiste DbNull para el
      // campo `storageState` (no `undefined`), porque Prisma no acepta
      // `undefined` para columnas opcionales.
      expect(prisma.ejecucion.update).toHaveBeenCalledWith({
        where: { id: "ejec-1" },
        data: {
          estado: "paso",
          finAt: expect.any(Date),
          duracionMs: 1500,
          errorMsg: null,
          storageState: expect.anything(), // Prisma.DbNull en runtime
        },
      });
    });

    it("persiste el outputStorageState como JSON", async () => {
      (prisma.ejecucion.update as jest.Mock).mockResolvedValue({});

      await persistExecutionResult("ejec-1", {
        finalEstado: "paso",
        outputStorageState: { cookies: [{ name: "x" }] },
      });

      const call = (prisma.ejecucion.update as jest.Mock).mock.calls[0][0];
      expect(call.data.storageState).toEqual({ cookies: [{ name: "x" }] });
    });

    it("serializa errorMsg cuando está presente", async () => {
      (prisma.ejecucion.update as jest.Mock).mockResolvedValue({});

      await persistExecutionResult("ejec-1", {
        finalEstado: "errorMotor",
        errorMsg: "Algo explotó",
      });

      expect(prisma.ejecucion.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado: "errorMotor",
            errorMsg: "Algo explotó",
          }),
        }),
      );
    });
  });
});
