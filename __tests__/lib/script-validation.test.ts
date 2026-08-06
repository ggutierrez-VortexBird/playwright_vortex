import { validateScriptPath, resolveScriptPath, SCRIPT_PATH_REGEX } from "@/lib/script-validation";
import { promises as fs } from "fs";

jest.mock("fs", () => ({
  promises: {
    access: jest.fn(),
    constants: {
      R_OK: 4,
    },
  },
}));

describe("SCRIPT_PATH_REGEX", () => {
  it("should match valid .spec.ts path", () => {
    expect(SCRIPT_PATH_REGEX.test("tests/e2e/login.spec.ts")).toBe(true);
  });

  it("should match valid .test.ts path", () => {
    expect(SCRIPT_PATH_REGEX.test("tests/unit/utils.test.ts")).toBe(true);
  });

  it("should reject path with ..", () => {
    expect(SCRIPT_PATH_REGEX.test("tests/../secret.spec.ts")).toBe(false);
  });

  it("should reject absolute path (leading /)", () => {
    expect(SCRIPT_PATH_REGEX.test("/etc/passwd.spec.ts")).toBe(false);
  });

  it("should reject invalid extension (.js)", () => {
    expect(SCRIPT_PATH_REGEX.test("tests/example.js")).toBe(false);
  });

  it("should reject path with control chars", () => {
    expect(SCRIPT_PATH_REGEX.test("tests/exam\x00ple.spec.ts")).toBe(false);
  });
});

describe("validateScriptPath", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reject path with .. with 400-style error", async () => {
    const result = await validateScriptPath("tests/../secret.spec.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Formato de ruta inválido");
    expect(fs.access).not.toHaveBeenCalled();
  });

  it("should reject absolute path (leading /) with 400-style error", async () => {
    const result = await validateScriptPath("/etc/passwd.spec.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Formato de ruta inválido");
    expect(fs.access).not.toHaveBeenCalled();
  });

  it("should reject invalid extension (.js) with 400-style error", async () => {
    const result = await validateScriptPath("tests/example.js");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Formato de ruta inválido");
    expect(fs.access).not.toHaveBeenCalled();
  });

  it("should reject path with control chars with 400-style error", async () => {
    const result = await validateScriptPath("tests/exam\x00ple.spec.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Formato de ruta inválido");
    expect(fs.access).not.toHaveBeenCalled();
  });

  it("should return ENOENT error for non-existent file", async () => {
    (fs.access as jest.Mock).mockRejectedValue({ code: "ENOENT" });
    const result = await validateScriptPath("tests/missing.spec.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("no existe");
    expect(result.absolutePath).toBe("/app/playwright-scripts/tests/missing.spec.ts");
  });

  it("should return EACCES error for unreadable file", async () => {
    (fs.access as jest.Mock).mockRejectedValue({ code: "EACCES" });
    const result = await validateScriptPath("tests/locked.spec.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("no es legible");
    expect(result.absolutePath).toBe("/app/playwright-scripts/tests/locked.spec.ts");
  });

  it("should return generic error for unexpected fs error", async () => {
    (fs.access as jest.Mock).mockRejectedValue(new Error("Disk failure"));
    const result = await validateScriptPath("tests/bad.spec.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Error al acceder al script");
    expect(result.absolutePath).toBeDefined();
  });

  it("should return success for valid readable file", async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    const result = await validateScriptPath("tests/valid.spec.ts");
    expect(result.valid).toBe(true);
    expect(result.absolutePath).toBe("/app/playwright-scripts/tests/valid.spec.ts");
  });

  it("should skip existence check when checkExists is false", async () => {
    const result = await validateScriptPath("tests/any.spec.ts", { checkExists: false });
    expect(result.valid).toBe(true);
    expect(result.absolutePath).toBe("/app/playwright-scripts/tests/any.spec.ts");
    expect(fs.access).not.toHaveBeenCalled();
  });

  it("should accept .test.ts extension", async () => {
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    const result = await validateScriptPath("tests/example.test.ts");
    expect(result.valid).toBe(true);
    expect(result.absolutePath).toBe("/app/playwright-scripts/tests/example.test.ts");
  });
});

describe("resolveScriptPath", () => {
  const originalEnv = process.env.PLAYWRIGHT_SCRIPTS_ROOT;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.PLAYWRIGHT_SCRIPTS_ROOT = originalEnv;
    } else {
      delete process.env.PLAYWRIGHT_SCRIPTS_ROOT;
    }
  });

  it("should resolve with default root", () => {
    delete process.env.PLAYWRIGHT_SCRIPTS_ROOT;
    const resolved = resolveScriptPath("tests/example.spec.ts");
    expect(resolved).toBe("/app/playwright-scripts/tests/example.spec.ts");
  });

  it("should resolve with custom root parameter", () => {
    const resolved = resolveScriptPath("tests/example.spec.ts", "/custom/root");
    expect(resolved).toBe("/custom/root/tests/example.spec.ts");
  });

  it("should resolve with env root", () => {
    process.env.PLAYWRIGHT_SCRIPTS_ROOT = "/env/root";
    const resolved = resolveScriptPath("tests/example.spec.ts");
    expect(resolved).toBe("/env/root/tests/example.spec.ts");
  });

  it("should prefer parameter root over env", () => {
    process.env.PLAYWRIGHT_SCRIPTS_ROOT = "/env/root";
    const resolved = resolveScriptPath("tests/example.spec.ts", "/param/root");
    expect(resolved).toBe("/param/root/tests/example.spec.ts");
  });
});
