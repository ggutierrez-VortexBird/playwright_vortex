// __tests__/lib/worker/script-temp.test.ts
// Tests for HU-3 Motor de Ejecución Playwright — AC-3, AC-7
// (script temp file writing and cleanup)
//
// Detalle clave: `fs/promises` es un módulo de Node.js que expone tanto
// propiedades nombradas (writeFile, mkdir, etc.) como un `default` export.
// El código bajo test (`import fs from 'fs/promises'`) recibe el `default`,
// que es un objeto DISTINTO del namespace. Por eso `jest.mock` no funciona
// consistentemente con `next/jest` — la solución es `jest.spyOn` sobre
// `(fsPromises as any).default` (el objeto que ve el código bajo test).

import * as fsPromises from "fs/promises";
import { writeTempScript, cleanupTempScript, cleanupStaleScripts } from "@/lib/worker/script-temp";

const fs = (fsPromises as any).default as {
  writeFile: jest.Mock;
  unlink: jest.Mock;
  readdir: jest.Mock;
  stat: jest.Mock;
  mkdir: jest.Mock;
};

describe("writeTempScript (AC-3)", () => {
  beforeEach(() => {
    jest.spyOn(fs, "mkdir").mockResolvedValue(undefined as any);
    jest.spyOn(fs, "writeFile").mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("escribe el script y retorna una ruta con extensión .spec.ts", async () => {
    const tmpPath = await writeTempScript(
      'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});',
      "test.spec.ts"
    );

    expect(tmpPath).toMatch(/runtime[\\/]ejecuciones[\\/]/);
    expect(tmpPath).toMatch(/\.spec\.ts$/);
    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(fs.mkdir).toHaveBeenCalledWith(
      expect.stringMatching(/runtime[\\/]ejecuciones$/),
      { recursive: true }
    );
  });

  it("sanitiza caracteres peligrosos en el nombre del archivo (path traversal)", async () => {
    const tmpPath = await writeTempScript(
      "test('pasa');",
      "../../../etc/passwd.spec.ts"
    );

    expect(tmpPath).not.toMatch(/\.\.\//);
    expect(tmpPath).not.toContain("/etc/");
    expect(tmpPath).toMatch(/\.spec\.ts$/);
    expect(tmpPath).toMatch(/runtime[\\/]ejecuciones[\\/]/);
  });

  it("dos llamadas generan paths distintos (UUID por escritura)", async () => {
    const tmpPath1 = await writeTempScript("test1();", "test1.spec.ts");
    const tmpPath2 = await writeTempScript("test2();", "test2.spec.ts");

    expect(tmpPath1).not.toBe(tmpPath2);
  });
});

describe("cleanupTempScript (AC-3)", () => {
  beforeEach(() => {
    jest.spyOn(fs, "unlink").mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("elimina el archivo temporal llamando fs.unlink", async () => {
    const tmpPath = "C:\\runtime\\ejecuciones\\abc-test.spec.ts";
    await cleanupTempScript(tmpPath);

    expect(fs.unlink).toHaveBeenCalledWith(tmpPath);
  });

  it("no lanza error si el archivo no existe (ENOENT)", async () => {
    const error = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    fs.unlink.mockRejectedValue(error);

    const tmpPath = "C:\\runtime\\ejecuciones\\nonexistent.spec.ts";

    await expect(cleanupTempScript(tmpPath)).resolves.toBeUndefined();
  });
});

describe("cleanupStaleScripts (AC-3)", () => {
  beforeEach(() => {
    jest.spyOn(fs, "readdir").mockResolvedValue([] as any);
    jest.spyOn(fs, "stat").mockResolvedValue({ mtimeMs: 0 } as any);
    jest.spyOn(fs, "unlink").mockResolvedValue(undefined as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("borra archivos más viejos que maxAgeMs", async () => {
    const oldMtime = Date.now() - 2 * 60 * 60 * 1000;
    const newMtime = Date.now() - 5 * 60 * 1000;

    fs.readdir.mockResolvedValue(["old.spec.ts", "new.spec.ts"] as any);
    fs.stat
      .mockResolvedValueOnce({ mtimeMs: oldMtime } as any)
      .mockResolvedValueOnce({ mtimeMs: newMtime } as any);

    await cleanupStaleScripts(60 * 60 * 1000);

    expect(fs.unlink).toHaveBeenCalledTimes(1);
    expect(fs.unlink).toHaveBeenCalledWith(
      expect.stringMatching(/old\.spec\.ts$/)
    );
  });

  it("no falla si el directorio no existe", async () => {
    fs.readdir.mockRejectedValue(new Error("ENOENT"));

    await expect(cleanupStaleScripts()).resolves.toBeUndefined();
  });
});
