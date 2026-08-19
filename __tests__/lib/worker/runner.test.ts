// __tests__/lib/worker/runner.test.ts
// Tests for HU-3 Motor de Ejecución Playwright — AC-3, AC-11
// (reporter JSON parsing, state mapping, spawn stdout consumption)
//
// El contrato real (lib/worker/runner.ts):
// - `runPlaywrightTest(scriptPath, ejecucionId)` hace `spawn('npx', ['playwright', ...])`
// - Consume stdout chunk por chunk, divide por '\n', parsea cada línea como JSON.
// - Solo líneas con `type === 'step'` generan `prisma.pasoEjecucion.create`.
// - El estado se mapea: 'passed'|'paso' → 'paso'; 'failed'|'fallo' → 'fallo';
//   'skipped' → 'paso'; cualquier otro estado → 'fallo'.
// - `selfHealed` se toma del event si está definido, sino default false.
// - exit code 0 → resolve({ passed: true }); code 1 → resolve({ passed: false });
//   otro code → reject con error.
// - Los pending inserts se recolectan y se hace `Promise.all` antes de resolver.
// - `parseReporterEvent(line)` retorna JSON parseado o null si la línea no es JSON.

import { spawn } from "child_process";
import { prisma } from "@/lib/db";

jest.mock("child_process");
jest.mock("@/lib/db", () => ({
  prisma: {
    pasoEjecucion: {
      create: jest.fn(),
    },
  },
}));

// Mock kill-tree para evitar spawns reales de taskkill en tests
const killProcessTreeMock = jest.fn().mockResolvedValue(undefined);
jest.mock("@/lib/worker/kill-tree", () => ({
  killProcessTree: (...args: any[]) => killProcessTreeMock(...args),
}));

/**
 * Helper para construir un mock del proceso Playwright con stdout/stderr/on predefinidos.
 */
function mockProcess(opts: {
  stdoutData?: string;
  exitCode?: number | null;
  error?: Error;
}) {
  const proc: any = {
    stdout: {
      on: jest.fn((event: string, cb: (chunk: Buffer) => void) => {
        if (event === "data" && opts.stdoutData) {
          cb(Buffer.from(opts.stdoutData));
        }
      }),
    },
    stderr: { on: jest.fn() },
    on: jest.fn((event: string, cb: (arg: unknown) => void) => {
      if (event === "close" && opts.exitCode !== undefined && opts.exitCode !== null) {
        cb(opts.exitCode);
      }
      if (event === "error" && opts.error) {
        cb(opts.error);
      }
    }),
    kill: jest.fn(),
    pid: 12345,
  };
  (spawn as jest.Mock).mockReturnValue(proc);
  return proc;
}

describe("runPlaywrightTest — state mapping (AC-11)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("inserta pasos con estado 'paso' cuando el reporter emite estado 'paso'", async () => {
    mockProcess({
      stdoutData:
        '{"type":"step","numero":1,"descripcion":"Navegar a /login","estado":"paso","duracionMs":1234,"selfHealed":false,"errorMsg":null}\n' +
        '{"type":"step","numero":2,"descripcion":"Llenar formulario","estado":"paso","duracionMs":567,"selfHealed":false,"errorMsg":null}\n',
      exitCode: 0,
    });
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const { runPlaywrightTest } = await import("@/lib/worker/runner");
    const result = await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    expect(result.passed).toBe(true);
    expect(prisma.pasoEjecucion.create).toHaveBeenCalledTimes(2);
  });

  it("inyecta PLAYWRIGHT_VORTEX_OUTPUT_DIR en el env del spawn", async () => {
    mockProcess({ exitCode: 0 });
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const { runPlaywrightTest } = await import("@/lib/worker/runner");
    const result = await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    expect(result.outputDir).toBeDefined();
    expect(spawn).toHaveBeenCalledWith(
      "node",
      expect.any(Array),
      expect.objectContaining({
        env: expect.objectContaining({
          PLAYWRIGHT_VORTEX_OUTPUT_DIR: expect.any(String),
        }),
      })
    );
    const spawnCall = (spawn as jest.Mock).mock.calls[0];
    const env = spawnCall[2].env;
    expect(env.PLAYWRIGHT_VORTEX_OUTPUT_DIR).toContain("ejec-1");
  });

  it("inserta paso con estado 'fallo' cuando el reporter emite estado 'fallo' con errorMsg", async () => {
    mockProcess({
      stdoutData:
        '{"type":"step","numero":1,"descripcion":"Click en boton","estado":"fallo","duracionMs":1000,"errorMsg":"Timeout 30000ms"}\n',
      exitCode: 1,
    });
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const { runPlaywrightTest } = await import("@/lib/worker/runner");
    const result = await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    expect(result.passed).toBe(false);
    expect(prisma.pasoEjecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ejecucionId: "ejec-1",
          estado: "fallo",
          errorMsg: "Timeout 30000ms",
        }),
      })
    );
  });

  it("ignora líneas que no son JSON válido (AC-11)", async () => {
    mockProcess({
      stdoutData:
        "Some warning log\n" +
        '{"type":"step","numero":1,"descripcion":"Test step","estado":"paso","duracionMs":500}\n' +
        "Another non-JSON line\n",
      exitCode: 0,
    });
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const { runPlaywrightTest } = await import("@/lib/worker/runner");
    await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    expect(prisma.pasoEjecucion.create).toHaveBeenCalledTimes(1);
  });

  it("preserva selfHealed=true cuando el reporter lo emite (AC-11)", async () => {
    mockProcess({
      stdoutData:
        '{"type":"step","numero":1,"descripcion":"Test paso","estado":"paso","duracionMs":800,"selfHealed":true}\n',
      exitCode: 0,
    });
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const { runPlaywrightTest } = await import("@/lib/worker/runner");
    await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    expect(prisma.pasoEjecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          selfHealed: true,
        }),
      })
    );
  });

  it("rechaza con error cuando Playwright sale con código no esperado (AC-3)", async () => {
    mockProcess({ exitCode: 2 });

    const { runPlaywrightTest } = await import("@/lib/worker/runner");
    await expect(
      runPlaywrightTest("/tmp/test.spec.ts", "ejec-1")
    ).rejects.toThrow(/Playwright exited with code 2/);
  });
});

describe("parseReporterEvent (AC-11)", () => {
  it("parsea correctamente un evento de step válido", async () => {
    const { parseReporterEvent } = await import("@/lib/worker/runner");

    const event = parseReporterEvent(
      '{"type":"step","numero":1,"descripcion":"Test","estado":"paso","duracionMs":100}'
    );
    expect(event).toEqual({
      type: "step",
      numero: 1,
      descripcion: "Test",
      estado: "paso",
      duracionMs: 100,
    });
  });

  it("retorna null para líneas no válidas (no-JSON)", async () => {
    const { parseReporterEvent } = await import("@/lib/worker/runner");

    const event = parseReporterEvent("not valid json");
    expect(event).toBeNull();
  });
});

describe("runPlaywrightTest — cancelación por isAborted (HU-3 Botón Detener)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("llama killProcessTree y rechaza con EjecucionCanceladaError cuando isAborted() retorna true", async () => {
    const closeHandlers: Array<(code: number | null) => void> = [];
    const proc: any = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event: string, cb: (arg: unknown) => void) => {
        if (event === "close") {
          closeHandlers.push(cb as (code: number | null) => void);
        }
      }),
      kill: jest.fn(),
      pid: 12345,
    };
    (spawn as jest.Mock).mockReturnValue(proc);

    const isAborted = jest.fn().mockReturnValue(true);

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });

    const { runPlaywrightTest, EjecucionCanceladaError } = await import(
      "@/lib/worker/runner"
    );
    const promise = runPlaywrightTest(
      "/tmp/test.spec.ts",
      "ejec-1",
      isAborted
    );

    // Avanzar el timer del polling (default 1500ms) + margen
    await jest.advanceTimersByTimeAsync(2000);

    // killProcessTree fue llamado en modo graceful (force=false)
    expect(killProcessTreeMock).toHaveBeenCalledWith(12345, false);

    // Avanzar el grace period (5000ms) para que fuerce el kill
    await jest.advanceTimersByTimeAsync(5000);
    expect(killProcessTreeMock).toHaveBeenCalledWith(12345, true);

    jest.useRealTimers();

    // Simular que el proceso cerró con código 143 (SIGTERM en Unix)
    for (const h of closeHandlers) h(143);

    await expect(promise).rejects.toBeInstanceOf(EjecucionCanceladaError);
    await expect(promise).rejects.toThrow(/cancelada por el usuario/);
  });

  it("no mata el proceso si isAborted nunca retorna true (no cancela)", async () => {
    mockProcess({ exitCode: 0 });
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const isAborted = jest.fn().mockResolvedValue(false);

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const { runPlaywrightTest } = await import("@/lib/worker/runner");
    const promise = runPlaywrightTest(
      "/tmp/test.spec.ts",
      "ejec-1",
      isAborted
    );

    await jest.advanceTimersByTimeAsync(1500 * 3);

    expect(killProcessTreeMock).not.toHaveBeenCalled();

    jest.useRealTimers();

    const result = await promise;
    expect(result.passed).toBe(true);
  });
});
