// __tests__/lib/worker/script-temp.test.ts
// RED test — testing functionality that doesn't exist yet
// These tests verify AC-3, AC-7 (script temp file writing and cleanup)

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

jest.mock("fs/promises");

describe("writeTempScript", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("escribe archivo temporal con extensión .spec.ts", async () => {
    // This test will fail until writeTempScript is implemented
    const { writeTempScript } = require("@/lib/worker/script-temp");

    (fs.mkdir as jest.Mock).mockResolvedValue(undefined as any);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined as any);

    const script = 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});';
    const tmpPath = await writeTempScript("ejec-1", script, "test.spec.ts");

    expect(tmpPath).toContain("playwright-vortex");
    expect(tmpPath).toContain("ejec-1");
    expect(tmpPath).toEndWith(".spec.ts");
  });

  it("sanitiza el nombre del archivo eliminando caracteres peligrosos", async () => {
    const { writeTempScript } = require("@/lib/worker/script-temp");

    (fs.mkdir as jest.Mock).mockResolvedValue(undefined as any);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined as any);

    const script = 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});';
    // File name with path traversal attempt
    const tmpPath = await writeTempScript("ejec-1", script, "../../../etc/passwd.spec.ts");

    expect(tmpPath).not.toContain("..");
    expect(tmpPath).not.toContain("/etc/");
    expect(tmpPath).toContain("ejec-1");
  });

  it("dos llamadas para el mismo ejecucionId no colisionan (nombres únicos)", async () => {
    const { writeTempScript } = require("@/lib/worker/script-temp");

    (fs.mkdir as jest.Mock).mockResolvedValue(undefined as any);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined as any);

    const script = 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});';
    const tmpPath1 = await writeTempScript("ejec-1", script, "test1.spec.ts");
    const tmpPath2 = await writeTempScript("ejec-1", script, "test2.spec.ts");

    expect(tmpPath1).not.toBe(tmpPath2);
  });

  it("fuerza extensión .spec.ts aunque el filename original sea diferente", async () => {
    const { writeTempScript } = require("@/lib/worker/script-temp");

    (fs.mkdir as jest.Mock).mockResolvedValue(undefined as any);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined as any);

    const script = 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});';
    const tmpPath = await writeTempScript("ejec-1", script, "test.ts"); // .ts not .spec.ts

    expect(tmpPath).toEndWith(".spec.ts");
  });
});

describe("cleanupTempScript", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("elimina el archivo temporal", async () => {
    const { cleanupTempScript } = require("@/lib/worker/script-temp");

    (fs.unlink as jest.Mock).mockResolvedValue(undefined as any);

    const tmpPath = path.join(os.tmpdir(), "playwright-vortex", "ejec-1-test.spec.ts");
    await cleanupTempScript(tmpPath);

    expect(fs.unlink).toHaveBeenCalledWith(tmpPath);
  });

  it("no lanza error si el archivo no existe (silently succeeds)", async () => {
    const { cleanupTempScript } = require("@/lib/worker/script-temp");

    const error = new Error("ENOENT") as any;
    error.code = "ENOENT";
    (fs.unlink as jest.Mock).mockRejectedValue(error);

    const tmpPath = path.join(os.tmpdir(), "playwright-vortex", "nonexistent.spec.ts");
    // Should not throw
    await expect(cleanupTempScript(tmpPath)).resolves.toBeUndefined();
  });
});
