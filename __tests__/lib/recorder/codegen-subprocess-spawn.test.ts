/**
 * Tests del spawn de lib/recorder/codegen-subprocess.ts con
 * `node:child_process` mockeado.
 *
 * Lo que se protege:
 *   - Que ya NO se invoque `npx playwright codegen`. Ese binario abre
 *     siempre la ventana del Playwright Inspector, que es justo lo que se
 *     quería evitar, y obligaba a ocultarla desde el sistema operativo.
 *   - Que la parada pida apagado ordenado por stdin antes de recurrir a
 *     señales. En Windows las señales terminan el proceso sin ejecutar sus
 *     manejadores, así que el volcado final del runner no puede depender
 *     de ellas.
 *   - Que `ready()` distinga "el navegador abrió" de "el proceso murió".
 */

import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const spawnMock = jest.fn();

jest.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

class FakeChild extends EventEmitter {
  exitCode: number | null = null;
  killed = false;
  pid = 9999;
  readonly stdinWrites: string[] = [];
  readonly signals: string[] = [];
  readonly stdout = new EventEmitter();
  readonly stdin = {
    write: (chunk: string) => {
      this.stdinWrites.push(chunk);
      return true;
    },
  };

  kill(signal?: string): boolean {
    this.signals.push(signal ?? "SIGTERM");
    return true;
  }

  simulateExit(code: number): void {
    this.exitCode = code;
    this.emit("exit", code, null);
  }

  emitStdout(text: string): void {
    this.stdout.emit("data", Buffer.from(text, "utf8"));
  }
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { spawnCodegen } = require("@/lib/recorder/codegen-subprocess") as
  typeof import("@/lib/recorder/codegen-subprocess");

describe("recorder/codegen-subprocess.spawnCodegen (spawn mockeado)", () => {
  let tmpDir: string;
  let child: FakeChild;

  beforeEach(() => {
    jest.useFakeTimers();
    tmpDir = mkdtempSync(join(tmpdir(), "vxn-spawn-"));
    child = new FakeChild();
    spawnMock.mockReset();
    spawnMock.mockReturnValue(child);
  });

  afterEach(() => {
    jest.useRealTimers();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function lanzar(overrides: Record<string, unknown> = {}) {
    return spawnCodegen("ses-abc12345", {
      urlInicial: "https://example.com/login",
      navegador: "firefox",
      specDir: tmpDir,
      ...overrides,
    });
  }

  it("invoca el runner propio con node, no el binario de codegen", () => {
    const handle = lanzar();
    const [bin, args] = spawnMock.mock.calls[0] as [string, string[]];

    expect(bin).toBe(process.execPath);
    expect(args.slice(0, 2)).toEqual(["--import", "tsx"]);
    expect(args[2]!.replace(/\\/g, "/")).toContain("scripts/codegen-runner.ts");

    // Nada de npx / codegen / cmd.exe.
    const linea = [bin, ...args].join(" ");
    expect(linea).not.toContain("npx");
    expect(linea).not.toContain("codegen ");
    expect(linea).not.toContain("cmd.exe");

    expect(args).toContain("--session");
    expect(args).toContain("ses-abc12345");
    expect(args).toContain("--url");
    expect(args).toContain("https://example.com/login");
    expect(args).toContain("--browser");
    expect(args).toContain("firefox");
    expect(args).toContain("--out");
    expect(args).toContain(handle.specPath);
  });

  it("usa chromium cuando no se indica navegador", () => {
    lanzar({ navegador: undefined });
    const [, args] = spawnMock.mock.calls[0] as [string, string[]];
    expect(args[args.indexOf("--browser") + 1]).toBe("chromium");
  });

  it("deja stdin abierto para poder pedir la parada ordenada", () => {
    lanzar();
    const opciones = spawnMock.mock.calls[0]![2] as { stdio: string[] };
    expect(opciones.stdio[0]).toBe("pipe");
  });

  it("kill() pide 'stop' por stdin antes de mandar señales", async () => {
    const handle = lanzar();
    const parada = handle.kill();

    expect(child.stdinWrites).toEqual(["stop\n"]);
    expect(child.signals).toEqual([]);

    // El runner vuelca y sale por su cuenta: no hace falta ninguna señal.
    child.simulateExit(0);
    await parada;
    expect(child.signals).toEqual([]);
  });

  it("recurre a la señal solo si el runner no sale por su cuenta", async () => {
    const handle = lanzar();
    const parada = handle.kill();

    jest.advanceTimersByTime(3_000);
    expect(child.signals).toEqual(["SIGTERM"]);

    jest.advanceTimersByTime(1_000);
    expect(child.signals).toEqual(["SIGTERM", "SIGKILL"]);

    await parada;
  });

  it("kill() es idempotente", async () => {
    const handle = lanzar();
    const primera = handle.kill();
    child.simulateExit(0);
    await primera;

    await expect(handle.kill()).resolves.toBeUndefined();
    expect(child.stdinWrites).toEqual(["stop\n"]);
    expect(handle.isAlive()).toBe(false);
  });

  it("ready() resuelve true cuando el runner avisa que abrió el navegador", async () => {
    const handle = lanzar() as ReturnType<typeof spawnCodegen>;
    child.emitStdout('{"type":"ready","sessionId":"ses-abc12345"}\n');
    await expect(handle.ready()).resolves.toBe(true);
  });

  it("ready() resuelve false si el proceso muere antes de abrir nada", async () => {
    const handle = lanzar() as ReturnType<typeof spawnCodegen>;
    child.simulateExit(1);
    await expect(handle.ready()).resolves.toBe(false);
  });

  it("exitCode() devuelve el código con el que terminó el runner", async () => {
    const handle = lanzar() as ReturnType<typeof spawnCodegen>;
    child.simulateExit(0);
    await expect(handle.exitCode()).resolves.toBe(0);
  });
});
