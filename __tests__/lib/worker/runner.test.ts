// __tests__/lib/worker/runner.test.ts
// RED test — testing functionality that doesn't exist yet
// These tests verify AC-3, AC-11 (reporter JSON parsing and state mapping)

import { spawn } from "child_process";
import { prisma } from "@/lib/db";

jest.mock("child_process");
jest.mock("@/lib/db", () => ({
  prisma: {
    pasoEjecucion: {
      create: jest.fn(),
    },
    ejecucion: {
      update: jest.fn(),
    },
  },
}));

describe("runPlaywrightTest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("parsea eventos JSON del reporter y mapea estado paso correctamente — AC-11", async () => {
    const { runPlaywrightTest } = require("@/lib/worker/runner");

    const mockSpawn = spawn as jest.Mock;
    const mockProc = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === "data") {
            // Simulate reporter JSON output
            cb(Buffer.from('{"type":"step","numero":1,"descripcion":"Navegar a /login","estado":"paso","duracionMs":1234}\n'));
            cb(Buffer.from('{"type":"step","numero":2,"descripcion":"Llenar formulario","estado":"paso","duracionMs":567}\n'));
          }
        }),
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event, cb) => {
        if (event === "close") cb(0);
        if (event === "error") cb(new Error("spawn error"));
      }),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProc);
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const result = await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    expect(result.passed).toBe(true);
    expect(prisma.pasoEjecucion.create).toHaveBeenCalledTimes(2);
    expect(prisma.pasoEjecucion.create).toHaveBeenCalledWith({
      data: {
        ejecucionId: "ejec-1",
        numero: 1,
        descripcion: "Navegar a /login",
        estado: "paso",
        duracionMs: 1234,
        selfHealed: false,
        errorMsg: null,
      },
    });
  });

  it("mapea estado fallo del reporter a estado fallo de Prisma — AC-11", async () => {
    const { runPlaywrightTest } = require("@/lib/worker/runner");

    const mockSpawn = spawn as jest.Mock;
    const mockProc = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === "data") {
            cb(Buffer.from('{"type":"step","numero":1,"descripcion":"Click en boton","estado":"fallo","duracionMs":1000,"errorMsg":"Timeout 30000ms"}\n'));
          }
        }),
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event, cb) => {
        if (event === "close") cb(1); // exit code 1 = tests failed
      }),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProc);
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const result = await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    expect(result.passed).toBe(false);
    expect(prisma.pasoEjecucion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: "fallo",
          errorMsg: "Timeout 30000ms",
        }),
      })
    );
  });

  it("ignora líneas que no son JSON válido — AC-11", async () => {
    const { runPlaywrightTest } = require("@/lib/worker/runner");

    const mockSpawn = spawn as jest.Mock;
    const mockProc = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === "data") {
            // Non-JSON output from Playwright
            cb(Buffer.from("Some warning log\n"));
            cb(Buffer.from('{"type":"step","numero":1,"descripcion":"Test step","estado":"paso","duracionMs":500}\n'));
            cb(Buffer.from("Another non-JSON line\n"));
          }
        }),
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event, cb) => {
        if (event === "close") cb(0);
      }),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProc);
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    const result = await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    // Only 1 step should be created (the valid JSON line)
    expect(prisma.pasoEjecucion.create).toHaveBeenCalledTimes(1);
    expect(result.passed).toBe(true);
  });

  it("inserta paso con selfHealed true cuando el reporter lo indica — AC-11", async () => {
    const { runPlaywrightTest } = require("@/lib/worker/runner");

    const mockSpawn = spawn as jest.Mock;
    const mockProc = {
      stdout: {
        on: jest.fn((event, cb) => {
          if (event === "data") {
            cb(Buffer.from('{"type":"step","numero":1,"descripcion":"Test paso","estado":"reparado","duracionMs":800,"selfHealed":true}\n'));
          }
        }),
      },
      stderr: { on: jest.fn() },
      on: jest.fn((event, cb) => {
        if (event === "close") cb(0);
      }),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProc);
    (prisma.pasoEjecucion.create as jest.Mock).mockResolvedValue({});

    await runPlaywrightTest("/tmp/test.spec.ts", "ejec-1");

    expect(prisma.pasoEjecucion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        selfHealed: true,
        estado: "reparado",
      }),
    });
  });

  it("hace reject cuando Playwright sale con código de error no manejado — AC-3", async () => {
    const { runPlaywrightTest } = require("@/lib/worker/runner");

    const mockSpawn = spawn as jest.Mock;
    const mockProc = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, cb) => {
        if (event === "close") cb(2); // Unexpected exit code
      }),
      kill: jest.fn(),
    };
    mockSpawn.mockReturnValue(mockProc);

    await expect(runPlaywrightTest("/tmp/test.spec.ts", "ejec-1")).rejects.toThrow(
      "Playwright exited with code 2"
    );
  });
});

describe("parseReporterEvent", () => {
  it("parsea correctamente un evento de step válido", async () => {
    const { parseReporterEvent } = require("@/lib/worker/runner");

    const event = parseReporterEvent('{"type":"step","numero":1,"descripcion":"Test","estado":"paso","duracionMs":100}');
    expect(event).toEqual({
      type: "step",
      numero: 1,
      descripcion: "Test",
      estado: "paso",
      duracionMs: 100,
      selfHealed: false,
      errorMsg: null,
    });
  });

  it("retorna null para líneas no válidas", async () => {
    const { parseReporterEvent } = require("@/lib/worker/runner");

    const event = parseReporterEvent("not valid json");
    expect(event).toBeNull();
  });
});
