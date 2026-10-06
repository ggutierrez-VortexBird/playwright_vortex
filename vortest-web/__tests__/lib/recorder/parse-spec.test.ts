/**
 * parse-spec.test.ts — tests unitarios del parser de .spec.ts a pasos.
 * Cubre cada tipo de acción que Playwright codegen emite y los casos borde
 * que rompían la UI del grabador.
 */
import {
  parseSpec,
  parseSpecToSteps,
  type SpecLine,
} from "@/lib/recorder/parse-spec";

describe("parseSpec", () => {
  describe("categorización básica", () => {
    test('"import { test, expect } ..." → kind=import', () => {
      const lines = parseSpec(
        `import { test, expect } from '@playwright/test';`,
      );
      expect(lines[0]!.kind).toBe("import");
    });

    test('"test("foo", async ({ page }) => {" → kind=test-header', () => {
      const lines = parseSpec(`test("foo", async ({ page }) => {`);
      expect(lines[0]!.kind).toBe("test-header");
    });

    test('"// comentario" → kind=comment', () => {
      const lines = parseSpec(`// un comentario`);
      expect(lines[0]!.kind).toBe("comment");
    });

    test('"await page.goto("https://x.com")" → kind=goto, selectorText=URL, description legible', () => {
      const lines = parseSpec(`  await page.goto("https://app.example.com/login");`);
      expect(lines[0]!.kind).toBe("goto");
      expect(lines[0]!.selectorText).toBe("https://app.example.com/login");
      expect(lines[0]!.description).toBe("Ir a https://app.example.com/login");
    });
  });

  describe("interacciones (click/fill/press/check/select/hover)", () => {
    test("click sobre getByRole con name", () => {
      const lines = parseSpec(
        `await page.getByRole('button', { name: 'Iniciar sesión' }).click();`,
      );
      expect(lines[0]!.kind).toBe("click");
      expect(lines[0]!.selectorText).toBe(
        "getByRole('button', { name: 'Iniciar sesión' })",
      );
      expect(lines[0]!.description).toBe(
        "Click en getByRole('button', { name: 'Iniciar sesión' })",
      );
    });

    test("click sobre getByLabel", () => {
      const lines = parseSpec(`await page.getByLabel('Email').click();`);
      expect(lines[0]!.kind).toBe("click");
      expect(lines[0]!.selectorText).toBe("getByLabel('Email')");
    });

    test("click sobre locator con cadena", () => {
      const lines = parseSpec(
        `await page.locator('button.submit').first().click();`,
      );
      expect(lines[0]!.kind).toBe("click");
      // El selector debe ser legible sin `.first()`
      expect(lines[0]!.selectorText).toBe("locator('button.submit')");
    });

    test("fill con valor no-secret → muestra el valor completo", () => {
      const lines = parseSpec(`await page.getByLabel('Email').fill('foo@example.com');`);
      expect(lines[0]!.kind).toBe("fill");
      expect(lines[0]!.selectorText).toBe("getByLabel('Email')");
      expect(lines[0]!.description).toBe(
        "Completar getByLabel('Email') con «foo@example.com»",
      );
    });

    test("fill con valor password → enmascara con ••••••", () => {
      const lines = parseSpec(
        `await page.getByLabel('Password').fill('super-secret-123');`,
      );
      expect(lines[0]!.description).toContain("••••••");
      expect(lines[0]!.description).not.toContain("super-secret-123");
    });

    test("fill en campo 'Token' → enmascara aunque el valor no parezca secreto", () => {
      const lines = parseSpec(`await page.getByLabel('API token').fill('xxx');`);
      expect(lines[0]!.description).toContain("••••••");
    });

    test("fill con valor 'sk_live_abc' → enmascara por pattern de secret en valor", () => {
      const lines = parseSpec(
        `await page.getByLabel('Some other field').fill('sk_live_abc');`,
      );
      expect(lines[0]!.description).toContain("••••••");
      expect(lines[0]!.description).not.toContain("sk_live_abc");
    });

    test("press con tecla", () => {
      const lines = parseSpec(`await page.getByLabel('Email').press('Tab');`);
      expect(lines[0]!.kind).toBe("press");
      expect(lines[0]!.description).toContain("Press Tab");
    });

    test("check / uncheck", () => {
      const lines = parseSpec(`await page.getByLabel('Recordarme').check();`);
      expect(lines[0]!.kind).toBe("check");
      expect(lines[0]!.description).toContain("Marcar");
    });

    test("selectOption", () => {
      const lines = parseSpec(
        `await page.getByLabel('País').selectOption('Argentina');`,
      );
      expect(lines[0]!.kind).toBe("select");
    });

    test("hover", () => {
      const lines = parseSpec(`await page.getByText('Ayuda').hover();`);
      expect(lines[0]!.kind).toBe("hover");
    });
  });

  describe("assertions", () => {
    test('expect(...).toBeVisible() → kind=assertion, description="Verificar visibilidad de ..."', () => {
      const lines = parseSpec(
        `await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();`,
      );
      expect(lines[0]!.kind).toBe("assertion");
      expect(lines[0]!.description).toBe(
        "Verificar visibilidad de getByRole('heading', { name: 'Login' })",
      );
    });

    test('expect(...).toHaveText("foo") → description incluye el texto a matchear', () => {
      const lines = parseSpec(
        `await expect(page.getByTestId('title')).toHaveText('Carrito');`,
      );
      expect(lines[0]!.kind).toBe("assertion");
      expect(lines[0]!.description).toBe(
        "Verificar texto de getByTestId('title') ('Carrito')",
      );
    });

    test('expect(...).toHaveValue("foo") → "Verificar valor de ..."', () => {
      const lines = parseSpec(
        `await expect(page.getByLabel('Email')).toHaveValue('foo@example.com');`,
      );
      expect(lines[0]!.kind).toBe("assertion");
      expect(lines[0]!.description).toContain("Verificar valor de");
    });

    test("matcher desconocido → cae en el nombre del matcher", () => {
      const lines = parseSpec(`await expect(page.locator('h1')).toBeCool();`);
      expect(lines[0]!.kind).toBe("assertion");
      expect(lines[0]!.description).toContain("toBeCool");
    });
  });

  describe("robustez", () => {
    test("líneas vacías se ignoran por default", () => {
      const lines = parseSpec(`\n\n\n  \n`);
      expect(lines).toHaveLength(0);
    });

    test("líneas vacías con includeEmpty=true se devuelven como rawText=''", () => {
      const lines = parseSpec(`x\n\n`, { includeEmpty: true });
      // 3 splits: ["x", "", ""] — todos pasan
      expect(lines).toHaveLength(3);
      expect(lines[1]!.rawText).toBe("");
      expect(lines[2]!.rawText).toBe("");
    });

    test("una línea sin patrón conocido → kind=other, description=trimmed", () => {
      const lines = parseSpec(`console.log("debug");`);
      expect(lines[0]!.kind).toBe("other");
      expect(lines[0]!.description).toBe(`console.log("debug");`);
    });

    test("await suelto → kind=navigate", () => {
      const lines = parseSpec(`await page.waitForLoadState('networkidle');`);
      expect(lines[0]!.kind).toBe("navigate");
    });

    test("preserva el número de línea (1-indexed)", () => {
      const spec = [
        `import { test } from '@playwright/test';`,
        ``,
        `test('a', async ({ page }) => {`,
        `  await page.goto('https://x');`,
        `});`,
      ].join("\n");
      const lines = parseSpec(spec);
      // Esperado: línea 1 = import, 4 = goto
      expect(lines.find((l: SpecLine) => l.kind === "goto")?.number).toBe(4);
    });
  });

  describe("parseSpecToSteps (helper para el paso-panel)", () => {
    test("filtra imports, headers, comentarios y `other`", () => {
      const spec = [
        `import { test, expect } from '@playwright/test';`,
        ``,
        `test('login', async ({ page }) => {`,
        `  // navegamos`,
        `  await page.goto('https://app.example.com');`,
        `  await page.getByLabel('Email').fill('foo@example.com');`,
        `  console.log('debug');`, // queda fuera
        `  await page.getByRole('button', { name: 'Login' }).click();`,
        `  await expect(page.getByText('Bienvenido')).toBeVisible();`,
        `});`,
      ].join("\n");
      const steps = parseSpecToSteps(spec);
      // Solo los await pasan
      expect(steps).toHaveLength(4);
      expect(steps[0]!.kind).toBe("goto");
      expect(steps[1]!.kind).toBe("fill");
      expect(steps[2]!.kind).toBe("click");
      expect(steps[3]!.kind).toBe("assertion");
    });

    test("devuelve [] para spec vacío", () => {
      expect(parseSpecToSteps("")).toEqual([]);
    });
  });

  describe("humanizePlaywrightArg", () => {
    test.each([
      [
        "page.getByRole('button', { name: 'Iniciar sesión' })",
        "getByRole('button', { name: 'Iniciar sesión' })",
      ],
      ["page.getByLabel('Email')", "getByLabel('Email')"],
      ["page.getByText('Continue')", "getByText('Continue')"],
      ["page.getByTestId('submit')", "getByTestId('submit')"],
      ["page.locator('button.submit')", "locator('button.submit')"],
      [
        "page.locator('button.submit').first()",
        "locator('button.submit')",
      ],
      [
        "page.locator('button.submit').nth(2)",
        "locator('button.submit')",
      ],
      ["page", "page"],
      ["page.locator('')", "locator('')"],
    ])("'%s' → '%s'", (input, expected) => {
      const lines = parseSpec(`await ${input}.click();`);
      expect(lines[0]!.selectorText).toBe(expected);
    });
  });
});
