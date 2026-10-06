import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("lib/worker/storage-state", () => {
  // El módulo `storage-state.ts` calcula `RUNTIME_DIR` una sola vez al ser
  // importado, usando `process.cwd()`. Para evitar contaminar el workspace
  // real, hacemos `process.chdir(tmpDir)` ANTES de requerir el módulo, y
  // lo cargamos dentro de `jest.isolateModules` para que su top-level
  // `const RUNTIME_DIR = path.resolve(process.cwd(), ...)` capture el
  // directorio temporal.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vortest-storage-"));
  const originalCwd = process.cwd();

  let mod: typeof import("@/lib/worker/storage-state");

  beforeAll(() => {
    process.chdir(tmpDir);
    jest.isolateModules(() => {
      // require() re-ejecuta el módulo bajo isolateModules.
      mod = require("@/lib/worker/storage-state");
    });
  });

  afterAll(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  beforeEach(() => {
    // Limpia el runtime dir entre tests para empezar limpio.
    const runtimeDir = path.join(tmpDir, "runtime", "storage-state");
    if (fs.existsSync(runtimeDir)) {
      fs.rmSync(runtimeDir, { recursive: true, force: true });
    }
  });

  it("ensureRuntimeDir crea el directorio runtime/storage-state", () => {
    expect(fs.existsSync(path.join(tmpDir, "runtime", "storage-state"))).toBe(false);
    mod.ensureRuntimeDir();
    expect(fs.existsSync(path.join(tmpDir, "runtime", "storage-state"))).toBe(true);
  });

  it("getStorageStatePath retorna la ruta esperada", () => {
    const p = mod.getStorageStatePath("ejec-1");
    expect(p).toBe(path.join(tmpDir, "runtime", "storage-state", "ejec-1.json"));
  });

  it("writeStorageState escribe JSON pretty al archivo", () => {
    mod.writeStorageState("ejec-2", { cookies: [{ name: "x" }], origins: [] });
    const filePath = path.join(tmpDir, "runtime", "storage-state", "ejec-2.json");
    expect(fs.existsSync(filePath)).toBe(true);
    const contents = fs.readFileSync(filePath, "utf-8");
    expect(contents).toContain('"cookies"');
    expect(contents).toContain('"origins"');
    expect(contents).toMatch(/\{\n\s+"/); // pretty-printed
  });

  it("writeStorageState con null/undefined escribe un shell por defecto", () => {
    mod.writeStorageState("ejec-3", null);
    const parsed = mod.readStorageState("ejec-3") as {
      cookies: unknown[];
      origins: unknown[];
    };
    expect(parsed).toEqual({ cookies: [], origins: [] });
  });

  it("readStorageState retorna null si el archivo no existe", () => {
    expect(mod.readStorageState("nope")).toBeNull();
  });

  it("readStorageState parsea JSON válido", () => {
    mod.writeStorageState("ejec-4", {
      cookies: [{ name: "session", value: "abc" }],
    });
    const result = mod.readStorageState("ejec-4");
    expect(result).toEqual({ cookies: [{ name: "session", value: "abc" }] });
  });

  it("readStorageState retorna null si el JSON está corrupto", () => {
    mod.ensureRuntimeDir();
    const filePath = path.join(
      tmpDir,
      "runtime",
      "storage-state",
      "ejec-broken.json",
    );
    fs.writeFileSync(filePath, "no es json {");
    expect(mod.readStorageState("ejec-broken")).toBeNull();
  });

  it("cleanupStorageState elimina el archivo", () => {
    mod.writeStorageState("ejec-5", { cookies: [] });
    const filePath = path.join(tmpDir, "runtime", "storage-state", "ejec-5.json");
    expect(fs.existsSync(filePath)).toBe(true);
    mod.cleanupStorageState("ejec-5");
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("cleanupStorageState no lanza si el archivo no existe", () => {
    expect(() => mod.cleanupStorageState("no-existe")).not.toThrow();
  });
});
