/**
 * Tests para HU-G14/HU-G11: el codegen debe emitir
 * `page.getByRole('searchbox', { name: 'Buscar en Wikipedia' })`
 * cuando el candidate.role trae un `name` accesible.
 *
 * Bug que cubre: antes el codegen emitia `getByRole('button')` sin
 * `{ name }` aunque el element tuviera accessible name, y Playwright
 * fallaba con strict mode violation o matching incorrecto.
 */

import {
  serializarPaso,
  serializarPasos,
  type PasoParaSerializar,
} from "@/lib/grabador/codegen/serialize";

function basePaso(over: Partial<PasoParaSerializar> = {}): PasoParaSerializar {
  return {
    id: "p1",
    numero: 1,
    tipo: "clic",
    descripcion: "Clic en «Buscar en Wikipedia»",
    selectorPrincipal: null,
    selectoresRespaldo: [],
    valor: null,
    esValorSensible: false,
    assertionKind: null,
    ...over,
  };
}

describe("codegen — role candidate with accessible name (HU-G14)", () => {
  it("clic on searchbox emits getByRole with { name }", () => {
    const paso = basePaso({
      descripcion: "Clic en «Buscar en Wikipedia»",
      selectoresRespaldo: [
        { strategy: "role", value: "searchbox", name: "Buscar en Wikipedia" },
      ],
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.getByRole(`searchbox`, { name: `Buscar en Wikipedia` }).click();",
    );
  });

  it("fill on combobox emits getByRole with { name } + fill", () => {
    const paso = basePaso({
      tipo: "escribir",
      descripcion: "Escribir «Julián Alvarez» en «Buscar en Wikipedia»",
      selectoresRespaldo: [
        { strategy: "role", value: "combobox", name: "Buscar en Wikipedia" },
      ],
      valor: "Julián Alvarez",
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.getByRole(`combobox`, { name: `Buscar en Wikipedia` }).first().fill(`Julián Alvarez`);",
    );
  });

  it("clic on button emits getByRole with { name }", () => {
    const paso = basePaso({
      descripcion: "Clic en «Buscar»",
      selectoresRespaldo: [
        { strategy: "role", value: "button", name: "Buscar" },
      ],
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.getByRole(`button`, { name: `Buscar` }).click();",
    );
  });

  it("prefers role+name over aria-label when both present", () => {
    // HU-G14: role es mas prioritario que aria-label cuando hay name.
    const paso = basePaso({
      descripcion: "Clic en «Buscar»",
      selectoresRespaldo: [
        { strategy: "aria-label", value: `[aria-label="Buscar en Wikipedia"]` },
        { strategy: "role", value: "searchbox", name: "Buscar en Wikipedia" },
      ],
    });
    const code = serializarPaso(paso) ?? "";
    expect(code).toContain("getByRole");
    expect(code).toContain("searchbox");
    expect(code).toContain("Buscar en Wikipedia");
    expect(code).not.toContain("getByLabel");
  });

  it("uses getByRole even without name when it is the only candidate", () => {
    const paso: PasoParaSerializar = {
      id: "p1",
      numero: 1,
      tipo: "clic",
      descripcion: "Clic en main landmark", // sin «...»
      selectorPrincipal: null,
      selectoresRespaldo: [{ strategy: "role", value: "main" }],
      valor: null,
      esValorSensible: false,
      assertionKind: null,
    };
    const code = serializarPaso(paso) ?? "";
    // Role sin name util pero sin fallback disponible → getByRole como ultimo
    // recurso. Playwright strict mode se encarga de detectar ambiguedad.
    expect(code).toContain("getByRole(`main`)");
    expect(code).not.toContain("sin selector unico");
  });

  it("caps the name string at 50 chars (defense against huge accessible names)", () => {
    const longName = "x".repeat(200);
    const paso = basePaso({
      selectoresRespaldo: [
        { strategy: "role", value: "button", name: longName },
      ],
    });
    const code = serializarPaso(paso) ?? "";
    // El nombre del role option aparece UNA sola vez, capped a 50 chars.
    const matches = code.match(/name: `([^`]+)`/);
    expect(matches).not.toBeNull();
    expect(matches![1]!.length).toBe(50);
  });

  it("falls back to next candidate when role has no useful name", () => {
    // FIX ronda 5: NO usar descripcion como fallback para accessible name.
    // La descripcion es para humanos y puede contener atributos HTML name
    // (ej. "login-button") que NO son el accessible name real. Si role no
    // tiene name util, caemos al siguiente candidate.
    const paso = basePaso({
      descripcion: "Clic en «Buscar en Wikipedia»",
      selectoresRespaldo: [
        { strategy: "role", value: "searchbox" },
        { strategy: "id", value: "#search" },
      ],
    });
    const code = serializarPaso(paso) ?? "";
    // Role sin name util → cae a id.
    expect(code).toContain("locator(`#search`)");
    expect(code).not.toContain("getByRole(`searchbox`)");
  });

  it("end-to-end: serializes a search scenario with navegar + clic + fill", () => {
    const pasos: PasoParaSerializar[] = [
      basePaso({
        id: "p1",
        numero: 1,
        tipo: "navegar",
        descripcion: "Abrir «https://es.wikipedia.org/»",
        valor: "https://es.wikipedia.org/",
      }),
      basePaso({
        id: "p2",
        numero: 2,
        tipo: "clic",
        descripcion: "Clic en «Buscar en Wikipedia»",
        selectoresRespaldo: [
          { strategy: "role", value: "searchbox", name: "Buscar en Wikipedia" },
        ],
      }),
      basePaso({
        id: "p3",
        numero: 3,
        tipo: "escribir",
        descripcion: "Escribir «Julián Alvarez» en «Buscar en Wikipedia»",
        selectoresRespaldo: [
          { strategy: "role", value: "combobox", name: "Buscar en Wikipedia" },
        ],
        valor: "Julián Alvarez",
      }),
      basePaso({
        id: "p4",
        numero: 4,
        tipo: "esperar",
        descripcion: "Esperar 0.8s",
        valor: "800",
      }),
    ];

    const out = serializarPasos(pasos, {
      nombreDelCaso: "Wikipedia - Buscar futbolista",
      parametros: [],
    });

    expect(out).toContain("await page.goto(`https://es.wikipedia.org/`, { waitUntil: 'domcontentloaded' });");
    expect(out).toContain("await page.getByRole(`searchbox`, { name: `Buscar en Wikipedia` }).click();");
    expect(out).toContain("await page.getByRole(`combobox`, { name: `Buscar en Wikipedia` }).first().fill(`Julián Alvarez`);");
    expect(out).toContain("await page.waitForTimeout(800);");
    // Cada paso con su comentario de descripción
    expect(out).toContain("// Paso 1: Abrir «https://es.wikipedia.org/»");
    expect(out).toContain("// Paso 2: Clic en «Buscar en Wikipedia»");
    expect(out).toContain("// Paso 3: Escribir «Julián Alvarez» en «Buscar en Wikipedia»");
    expect(out).toContain("// Paso 4: Esperar 0.8s");
  });
});

/**
 * FIX crítico ronda 3: las credenciales (password) ahora emiten un `fill()`
 * REAL contra `params.password`, NO un comentario. Antes el codegen emitía
 * solo `// Paso N: escribir credencial — agregar parametro` y el test
 * fallaba en login con "Username and password do not match" porque el
 * input quedaba vacío.
 */
describe("codegen — emit fill() real para password (no solo comment)", () => {
  it("auto-agrega `password: ''` al params object y emite fill(params.password)", () => {
    const pasos: PasoParaSerializar[] = [
      // Paso 1: goto saucedemo
      {
        id: "1", numero: 1, tipo: "navegar", descripcion: "Abrir saucedemo",
        selectorPrincipal: null, selectoresRespaldo: [], valor: "https://www.saucedemo.com/",
        esValorSensible: false, assertionKind: null,
      },
      // Paso 2: click en username
      {
        id: "2", numero: 2, tipo: "clic", descripcion: "Clic en user-name",
        selectorPrincipal: { tag: "input", name: "user-name" },
        selectoresRespaldo: [{ strategy: "name", value: "[name=\"user-name\"]" }],
        valor: null, esValorSensible: false, assertionKind: null,
      },
      // Paso 3: escribir username "standard_user"
      {
        id: "3", numero: 3, tipo: "escribir", descripcion: "Escribir standard_user en user-name",
        selectorPrincipal: { tag: "input", name: "user-name" },
        selectoresRespaldo: [{ strategy: "name", value: "[name=\"user-name\"]" }],
        valor: "standard_user", esValorSensible: false, assertionKind: null,
      },
      // Paso 4: click en password
      {
        id: "4", numero: 4, tipo: "clic", descripcion: "Clic en password",
        selectorPrincipal: { tag: "input", name: "password" },
        selectoresRespaldo: [{ strategy: "name", value: "[name=\"password\"]" }],
        valor: null, esValorSensible: false, assertionKind: null,
      },
      // Paso 5: escribir password (esValorSensible=true → debe emitir fill real)
      {
        id: "5", numero: 5, tipo: "escribir",
        descripcion: "Escribir «••••••» (credencial) en password",
        selectorPrincipal: { tag: "input", name: "password" },
        selectoresRespaldo: [{ strategy: "name", value: "[name=\"password\"]" }],
        valor: null, // ← masked por seguridad
        esValorSensible: true, // ← es password
        assertionKind: null,
      },
    ];

    const out = serializarPasos(pasos, { nombreDelCaso: "saucedemo-login" });

    // El fill de password debe ser un fill REAL, no un comment.
    expect(out).not.toContain("agregar parametro o credential setup");
    expect(out).toContain("await page.locator(`[name=\"password\"]`).first().fill(params.password);");

    // El params object debe tener `password: ""` auto-agregado.
    expect(out).toContain("password: \"\"");
    // Con TODO comment arriba del params para que el usuario edite el valor.
    expect(out).toContain("// TODO: reemplazar el valor de `password` antes de ejecutar");
  });
});

/**
 * FIX ronda 4: el test NUNCA debe pasar vacíamente. Si el usuario grabó un
 * flujo sin agregar ningún verify, emitimos un fallback `expect(body)` al
 * final. Antes el test "passed" sin校验 nada porque no había `expect()`.
 */
describe("codegen — fallback expect() para tests vac sin", () => {
  it("emite expect(body) cuando NO hay ningún verificar paso", () => {
    const pasos: PasoParaSerializar[] = [
      { id: "1", numero: 1, tipo: "navegar", descripcion: "Abrir",
        selectorPrincipal: null, selectoresRespaldo: [],
        valor: "https://example.com", esValorSensible: false, assertionKind: null },
      { id: "2", numero: 2, tipo: "clic", descripcion: "Click submit",
        selectorPrincipal: { tag: "button" },
        selectoresRespaldo: [{ strategy: "testid", value: "[data-testid=\"go\"]" }],
        valor: null, esValorSensible: false, assertionKind: null },
    ];
    const out = serializarPasos(pasos, { nombreDelCaso: "NoExpect" });
    expect(out).toContain("await expect(page.locator(\"body\").first()).toBeVisible()");
    expect(out).toContain("// FIX: fallback assertion");
  });

  it("NO emite fallback cuando ya hay un verificar paso", () => {
    const pasos: PasoParaSerializar[] = [
      { id: "1", numero: 1, tipo: "verificar", descripcion: "Verificar titulo",
        selectorPrincipal: { tag: "h1" },
        selectoresRespaldo: [{ strategy: "css", value: "h1" }],
        valor: "OK", esValorSensible: false, assertionKind: "texto_igual" },
    ];
    const out = serializarPasos(pasos, { nombreDelCaso: "HasExpect" });
    expect(out).not.toContain("fallback assertion");
  });
});

/**
 * FIX ronda 4: dedupe de fills consecutivos idénticos. El grabador actual
 * a veces genera 2 fills con el mismo (selector, valor) — colapsamos al
 * primero y SKIP silencioso del duplicado.
 */
describe("codegen — dedupe de fills consecutivos idénticos", () => {
  it("2 fills con mismo (selector, valor) → emite solo 1", () => {
    const fillPaso = (numero: number): PasoParaSerializar => ({
      id: String(numero), numero, tipo: "escribir",
      descripcion: `Escribir asdfa en user-name (${numero})`,
      selectorPrincipal: { tag: "input", name: "user-name" },
      selectoresRespaldo: [{ strategy: "name", value: "[name=\"user-name\"]" }],
      valor: "asdfa", esValorSensible: false, assertionKind: null,
    });
    const out = serializarPasos(
      [fillPaso(1), fillPaso(2)],
      { nombreDelCaso: "DupFill" },
    );
    // El fill debe aparecer UNA sola vez
    const matches = out.match(/\.fill\(`asdfa`\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("2 fills con DIFERENTE valor → emite ambos", () => {
    const f = (n: number, v: string): PasoParaSerializar => ({
      id: String(n), numero: n, tipo: "escribir",
      descripcion: `Escribir ${v} en user-name`,
      selectorPrincipal: { tag: "input", name: "user-name" },
      selectoresRespaldo: [{ strategy: "name", value: "[name=\"user-name\"]" }],
      valor: v, esValorSensible: false, assertionKind: null,
    });
    const out = serializarPasos(
      [f(1, "asd"), f(2, "asdfa")],
      { nombreDelCaso: "DiffFill" },
    );
    expect(out).toContain(".fill(`asd`)");
    expect(out).toContain(".fill(`asdfa`)");
  });
});
