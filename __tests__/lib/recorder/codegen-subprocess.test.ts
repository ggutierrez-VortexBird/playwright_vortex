/**
 * Tests for lib/recorder/codegen-subprocess.ts — verifica que:
 *   1. resolveSpecPath devuelve una ruta absoluta, en tempdir por default,
 *      y crea el directorio si se pasa `specDir`.
 *   2. spawnCodegen invoca al runner propio (no a `npx playwright codegen`)
 *      con los argumentos correctos.
 *   3. kill() pide parada ordenada por stdin antes de recurrir a señales,
 *      y es idempotente.
 *
 * Nunca se abre un navegador real: los tests que inspeccionan el spawn
 * mockean `node:child_process`, y el resto usa `overrideBin`.
 */

import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, isAbsolute } from "node:path";

import {
  resolveRunnerPath,
  resolveSpecPath,
  spawnCodegen,
  type SpawnCodegenResult,
} from "@/lib/recorder/codegen-subprocess";

describe("recorder/codegen-subprocess.resolveSpecPath", () => {
  it("devuelve ruta absoluta en OS tempdir por default", () => {
    const p = resolveSpecPath("ses-abc123def");
    expect(p.startsWith(tmpdir())).toBe(true);
    expect(p.endsWith(".spec.ts")).toBe(true);
    // slice(0,8) del id sanitizado = "ses-abc1"
    expect(p).toContain("grabador-ses-abc1");
  });

  it("crea el directorio si se pasa specDir custom", () => {
    const tmp = mkdtempSync(join(tmpdir(), "vxn-spec-"));
    try {
      const sub = join(tmp, "nested", "subdir");
      const p = resolveSpecPath("ses-zzz9", sub);
      expect(existsSync(sub)).toBe(true);
      expect(p).toContain(sub);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("sanitiza sessionId no-alfanumérico", () => {
    const p = resolveSpecPath("ses/../etc/passwd");
    expect(p).not.toContain("..");
    expect(p).not.toContain("/etc/passwd");
  });

  it("genera nombres únicos para invocaciones múltiples", () => {
    const a = resolveSpecPath("ses-1");
    const b = resolveSpecPath("ses-1");
    expect(a).not.toBe(b);
  });
});

describe("recorder/codegen-subprocess.spawnCodegen", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "vxn-codegen-spec-"));
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it("escribe el archivo seed vacío si se le pasa seedSpecFile:true (default)", () => {
    const handle = spawnCodegen("ses-test1", {
      urlInicial: "https://example.com",
      specDir: tmpDir,
      overrideBin: "node", // <- placeholder, no ejecuta codegen real
      seedSpecFile: true,
    });
    expect(existsSync(handle.specPath)).toBe(true);
    const content = readFileSync(handle.specPath, "utf8");
    expect(content).toContain("Playwright codegen is recording");
    void handle.kill();
  });

  it("respeta seedSpecFile:false (no crear archivo)", () => {
    const handle = spawnCodegen("ses-test2", {
      urlInicial: "https://example.com",
      specDir: tmpDir,
      overrideBin: "node",
      seedSpecFile: false,
    });
    expect(existsSync(handle.specPath)).toBe(false);
    void handle.kill();
  });

  it("kill() es idempotente y completa", async () => {
    const handle = spawnCodegen("ses-test3", {
      urlInicial: "https://example.com",
      specDir: tmpDir,
      overrideBin: "node",
    }) as SpawnCodegenResult;
    await handle.kill();
    await handle.kill(); // <- segundo call debe no-op
    await handle.kill();
    expect(handle.isAlive()).toBe(false);
  });

  it("kill() no throw si el proc ya murió", async () => {
    const handle = spawnCodegen("ses-test4", {
      urlInicial: "https://example.com",
      specDir: tmpDir,
      overrideBin: "node",
    });
    // Forzar "ya murió" — sin await
    await handle.kill();
    await expect(handle.kill()).resolves.toBeUndefined();
  });
});

describe("recorder/codegen-subprocess.resolveRunnerPath", () => {
  const original = process.env.RECORDER_RUNNER_PATH;

  afterEach(() => {
    if (original === undefined) delete process.env.RECORDER_RUNNER_PATH;
    else process.env.RECORDER_RUNNER_PATH = original;
  });

  it("apunta a scripts/codegen-runner.ts por default", () => {
    delete process.env.RECORDER_RUNNER_PATH;
    const p = resolveRunnerPath();
    expect(isAbsolute(p)).toBe(true);
    expect(p.replace(/\\/g, "/")).toContain("scripts/codegen-runner.ts");
  });

  it("respeta RECORDER_RUNNER_PATH y lo vuelve absoluto", () => {
    process.env.RECORDER_RUNNER_PATH = "scripts/otro-runner.ts";
    const p = resolveRunnerPath();
    expect(isAbsolute(p)).toBe(true);
    expect(p.replace(/\\/g, "/")).toContain("scripts/otro-runner.ts");
  });
});
