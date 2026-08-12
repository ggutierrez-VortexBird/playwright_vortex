// __tests__/lib/worker/validate-script.test.ts
// RED test — testing functionality that doesn't exist yet
// These tests verify AC-7 (script validation)

describe("validateScript", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("script vacío es inválido con mensaje 'Script vacío o no proporcionado' — AC-7", async () => {
    const { validateScript } = require("@/lib/worker/validate-script");

    const result = validateScript("", "test.spec.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Script vacío o no proporcionado");
  });

  it("script con solo espacios es inválido — AC-7", async () => {
    const { validateScript } = require("@/lib/worker/validate-script");

    const result = validateScript("   \n\t  ", "test.spec.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Script vacío o no proporcionado");
  });

  it("scriptFileName con extensión válida .spec.ts es válido — AC-7", async () => {
    const { validateScript } = require("@/lib/worker/validate-script");

    const script = 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});';
    const result = validateScript(script, "test.spec.ts");
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("scriptFileName con extensión válida .test.ts es válido — AC-7", async () => {
    const { validateScript } = require("@/lib/worker/validate-script");

    const script = 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});';
    const result = validateScript(script, "test.test.ts");
    expect(result.valid).toBe(true);
  });

  it("scriptFileName con extensión inválida es inválido con mensaje descriptivo — AC-7", async () => {
    const { validateScript } = require("@/lib/worker/validate-script");

    const script = 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});';
    const result = validateScript(script, "test.ts");
    expect(result.valid).toBe(false);
    expect(result.error).toContain(".spec.ts");
    expect(result.error).toContain(".test.ts");
  });

  it("scriptFileName null o undefined es válido (se usa default) — AC-7", async () => {
    const { validateScript } = require("@/lib/worker/validate-script");

    const script = 'import { test } from "@playwright/test"; test("pasa", async ({ page }) => {});';
    const result = validateScript(script, null);
    expect(result.valid).toBe(true);
  });

  it("script con contenido válido es válido aunque no sea Playwright sintácticamente — AC-7", async () => {
    const { validateScript } = require("@/lib/worker/validate-script");

    // Validation is lazy — only checks non-empty and filename extension
    const script = "not really playwright code but not empty";
    const result = validateScript(script, "test.spec.ts");
    expect(result.valid).toBe(true);
  });
});
