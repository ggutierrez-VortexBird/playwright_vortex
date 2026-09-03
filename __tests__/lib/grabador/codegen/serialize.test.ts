/**
 * Tests for lib/grabador/codegen/serialize.ts (HU-G11 + HU-G16).
 */

import {
  serializarPasos,
  serializarPaso,
  type PasoParaSerializar,
  type ParametroParaSerializar,
} from "@/lib/grabador/codegen/serialize";

function basePaso(over: Partial<PasoParaSerializar> = {}): PasoParaSerializar {
  return {
    id: "p1",
    numero: 1,
    tipo: "clic",
    descripcion: "Click en «Submit»",
    selectorPrincipal: { tag: "button", testId: "submit" },
    selectoresRespaldo: [
      { strategy: "testid", value: `[data-testid="submit"]` },
      { strategy: "css", value: "html > body > button" },
    ],
    valor: null,
    esValorSensible: false,
    assertionKind: null,
    ...over,
  };
}

describe("codegen/serialize — serializarPaso (HU-G11)", () => {
  it("navegar emits page.goto with the URL and waitUntil:'domcontentloaded'", () => {
    const paso = basePaso({
      tipo: "navegar",
      numero: 1,
      valor: "https://portal.example.com/login",
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.goto(`https://portal.example.com/login`, { waitUntil: 'domcontentloaded' });",
    );
  });

  it("clic emits the right Playwright method based on selector strategy", () => {
    const paso = basePaso({
      tipo: "clic",
      selectoresRespaldo: [{ strategy: "testid", value: `[data-testid="submit"]` }],
    });
    // NOTA: las acciones (clic/fill/press) NO llevan .first() porque si
    // hay multiples matches es mejor strict mode violation a timeout.
    expect(serializarPaso(paso)).toBe(
      "  await page.getByTestId(`submit`).click();",
    );
  });

  it("clic uses getByText for text strategy", () => {
    const paso = basePaso({
      tipo: "clic",
      selectoresRespaldo: [{ strategy: "text", value: "Submit" }],
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.getByText(`Submit`).click();",
    );
  });

  it("clic falls back to locator for css strategy", () => {
    const paso = basePaso({
      tipo: "clic",
      selectoresRespaldo: [{ strategy: "css", value: "html > body > button" }],
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.locator(`html > body > button`).click();",
    );
  });

  it("clic emits a comment when no selector is available", () => {
    const paso = basePaso({
      tipo: "clic",
      selectoresRespaldo: [],
      selectorPrincipal: null,
    });
    expect(serializarPaso(paso)).toContain("sin selector");
  });

  it("escribir uses fill with the value", () => {
    const paso = basePaso({
      tipo: "escribir",
      selectoresRespaldo: [{ strategy: "testid", value: `[data-testid="user"]` }],
      valor: "admin",
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.getByTestId(`user`).first().fill(`admin`);",
    );
  });

  it("esperar emits waitForTimeout with the parsed ms when <= MAX_WAIT_PERSIST_MS", () => {
    const paso = basePaso({
      tipo: "esperar",
      valor: "1500",
    });
    expect(serializarPaso(paso)).toBe("  await page.waitForTimeout(1500);");
  });

  it("esperar caps at 1000ms fallback when valor is unparseable", () => {
    const paso = basePaso({
      tipo: "esperar",
      valor: "not-a-number",
    });
    expect(serializarPaso(paso)).toBe("  await page.waitForTimeout(1000);");
  });

  it("esperar SKIPS (emits comment) when ms > MAX_WAIT_PERSIST_MS", () => {
    const paso = basePaso({
      tipo: "esperar",
      valor: "13000",
    });
    const out = serializarPaso(paso);
    expect(out).toContain("//");
    expect(out).toContain("13000");
    expect(out).toContain("omitido");
    expect(out).not.toContain("waitForTimeout(13000");
  });

  it("verificar visible → toBeVisible", () => {
    const paso = basePaso({
      tipo: "verificar",
      assertionKind: "visible",
      selectoresRespaldo: [{ strategy: "testid", value: `[data-testid="go"]` }],
    });
    expect(serializarPaso(paso)).toBe(
      "  await expect(page.getByTestId(`go`).first()).toBeVisible();",
    );
  });

  it("verificar texto_igual → toHaveText", () => {
    const paso = basePaso({
      tipo: "verificar",
      assertionKind: "texto_igual",
      valor: "Hola",
      selectoresRespaldo: [{ strategy: "text", value: "Greeting" }],
    });
    expect(serializarPaso(paso)).toBe(
      "  await expect(page.getByText(`Greeting`).first()).toHaveText(`Hola`);",
    );
  });

  it("verificar texto_contiene → toContainText", () => {
    const paso = basePaso({
      tipo: "verificar",
      assertionKind: "texto_contiene",
      valor: "sub",
      selectoresRespaldo: [{ strategy: "text", value: "Hello" }],
    });
    expect(serializarPaso(paso)).toBe(
      "  await expect(page.getByText(`Hello`).first()).toContainText(`sub`);",
    );
  });

  it("verificar valor_igual → toHaveValue", () => {
    const paso = basePaso({
      tipo: "verificar",
      assertionKind: "valor_igual",
      valor: "admin",
      selectoresRespaldo: [{ strategy: "testid", value: `[data-testid="user"]` }],
    });
    expect(serializarPaso(paso)).toBe(
      "  await expect(page.getByTestId(`user`).first()).toHaveValue(`admin`);",
    );
  });

  it("verificar count → toHaveCount with numeric value", () => {
    const paso = basePaso({
      tipo: "verificar",
      assertionKind: "count",
      valor: "5",
      selectoresRespaldo: [{ strategy: "testid", value: `[data-testid="item"]` }],
    });
    expect(serializarPaso(paso)).toBe(
      "  await expect(page.getByTestId(`item`).first()).toHaveCount(5);",
    );
  });

  it("generico returns null (no code-gen)", () => {
    const paso = basePaso({ tipo: "generico" });
    expect(serializarPaso(paso)).toBeNull();
  });

  it("escapes backticks in values", () => {
    const paso = basePaso({
      tipo: "navegar",
      valor: "https://example.com/path?a=`evil`",
    });
    const out = serializarPaso(paso);
    expect(out).toContain("\\`");
  });

  it("substitutes {{param}} in the value with params.nombre", () => {
    const paso = basePaso({
      tipo: "navegar",
      valor: "https://portal.example.com/{{usuario}}",
    });
    const out = serializarPaso(paso, [{ nombre: "usuario", valorDefecto: "admin" }]);
    expect(out).toBe(
      "  await page.goto(`https://portal.example.com/${params.usuario}`, { waitUntil: 'domcontentloaded' });",
    );
  });

  it("does NOT substitute params when none are provided", () => {
    const paso = basePaso({
      tipo: "navegar",
      valor: "https://portal.example.com/{{usuario}}",
    });
    const out = serializarPaso(paso, []);
    expect(out).toBe(
      "  await page.goto(`https://portal.example.com/{{usuario}}`, { waitUntil: 'domcontentloaded' });",
    );
  });

  it("derives candidates from selectorPrincipal when respaldo is empty", () => {
    const paso = basePaso({
      tipo: "clic",
      selectorPrincipal: { tag: "button", testId: "go" },
      selectoresRespaldo: null,
    });
    const out = serializarPaso(paso);
    expect(out).toBe(
      "  await page.getByTestId(`go`).click();",
    );
  });
});

describe("codegen/serialize — serializarPasos (HU-G11 + HU-G16)", () => {
  it("emits a valid TS header + imports + test() block", () => {
    const out = serializarPasos([], {
      nombreDelCaso: "Vacío",
      parametros: [],
    });
    expect(out).toContain("import { test, expect } from '@playwright/test';");
    expect(out).toContain(`test("Vacío", async ({ page }) => {`);
    expect(out).toContain("});");
  });

  it("includes a params literal with each parameter", () => {
    const out = serializarPasos([], {
      nombreDelCaso: "X",
      parametros: [
        { nombre: "usuario", valorDefecto: "admin" },
        { nombre: "clave", valorDefecto: "secret123" },
      ],
    });
    expect(out).toContain(`usuario: "admin",`);
    expect(out).toContain(`clave: "secret123",`);
  });

  it("emits an empty params literal when no params", () => {
    const out = serializarPasos([], {
      nombreDelCaso: "X",
      parametros: [],
    });
    expect(out).toContain("const params = {};");
  });

  it("emits a comment + code line per paso", () => {
    const pasos: PasoParaSerializar[] = [
      basePaso({
        numero: 1,
        tipo: "navegar",
        valor: "https://example.com",
      }),
      basePaso({
        id: "p2",
        numero: 2,
        tipo: "clic",
        selectoresRespaldo: [{ strategy: "testid", value: `[data-testid="go"]` }],
      }),
    ];
    const out = serializarPasos(pasos, {
      nombreDelCaso: "Smoke",
      parametros: [],
    });
    expect(out).toContain("// Paso 1: Click en «Submit»");
    expect(out).toContain("await page.goto(`https://example.com`, { waitUntil: 'domcontentloaded' });");
    expect(out).toContain("// Paso 2: Click en «Submit»");
    expect(out).toContain("await page.getByTestId(`go`).click();");
  });

  it("SKIPS generico pasos silently (no fallback comment) — ronda 4", () => {
    // Antes emitía "// (paso manual sin code-gen: revisar en UI)" que llenaba
    // el .spec.ts de ruido (13+ comentarios para un typing típico). Ahora
    // los generico (keydowns no-especiales) se SKIPpean silenciosos.
    const pasos: PasoParaSerializar[] = [
      basePaso({ numero: 1, tipo: "generico" }),
    ];
    const out = serializarPasos(pasos, {
      nombreDelCaso: "Generico",
      parametros: [],
    });
    expect(out).not.toContain("(paso manual sin code-gen");
    expect(out).not.toContain("// Paso 1:"); // tampoco comentario del paso
  });

  it("substitutes {{nombre}} in any paso's value with params.nombre", () => {
    const pasos: PasoParaSerializar[] = [
      basePaso({
        id: "p1",
        numero: 1,
        tipo: "escribir",
        selectoresRespaldo: [{ strategy: "testid", value: `[data-testid="user"]` }],
        valor: "{{usuario}}",
      }),
    ];
    const out = serializarPasos(pasos, {
      nombreDelCaso: "Param sub",
      parametros: [{ nombre: "usuario", valorDefecto: "admin" }],
    });
    expect(out).toContain("fill(`${params.usuario}`)");
    expect(out).toContain(`usuario: "admin",`);
  });

  it("emits valid TypeScript (no unbalanced parens/braces)", () => {
    const pasos: PasoParaSerializar[] = [
      basePaso({ numero: 1, tipo: "navegar", valor: "https://x.com" }),
      basePaso({ id: "p2", numero: 2, tipo: "esperar", valor: "500" }),
      basePaso({
        id: "p3",
        numero: 3,
        tipo: "verificar",
        assertionKind: "visible",
        selectoresRespaldo: [{ strategy: "css", value: "h1" }],
      }),
    ];
    const out = serializarPasos(pasos, {
      nombreDelCaso: "Sanity",
      parametros: [],
    });
    // Naive bracket count.
    const open = (out.match(/{/g) ?? []).length;
    const close = (out.match(/}/g) ?? []).length;
    expect(open).toBe(close);
    const openP = (out.match(/\(/g) ?? []).length;
    const closeP = (out.match(/\)/g) ?? []).length;
    expect(openP).toBe(closeP);
  });

  it("escapes special chars in case name (single quotes → safe)", () => {
    const out = serializarPasos([], {
      nombreDelCaso: 'Caso "comillas" raras',
      parametros: [],
    });
    // JSON.stringify escapes the quotes safely.
    expect(out).toContain('\\"');
  });

  it("respects a custom indent", () => {
    const pasos: PasoParaSerializar[] = [
      basePaso({ numero: 1, tipo: "esperar", valor: "100" }),
    ];
    const out = serializarPasos(pasos, {
      nombreDelCaso: "Indent",
      parametros: [],
      indent: "    ",
    });
    expect(out).toContain("    await page.waitForTimeout(100);");
  });
});
