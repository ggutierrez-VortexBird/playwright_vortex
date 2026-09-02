/**
 * Tests for HU-G14 — selector priority end-to-end.
 *
 * Verifies that the priority order testid > role > id > aria-label > name
 * > text > css is preserved through the pipeline (translator → candidates
 * → pickBestSelector → serialize.ts).
 */

import { pickBestSelector } from "@/lib/grabador/dom-utils";
import {
  serializarPaso,
  type PasoParaSerializar,
} from "@/lib/grabador/codegen/serialize";

describe("pickBestSelector — priority (HU-G14)", () => {
  it("prefers testid when available", () => {
    const best = pickBestSelector([
      { strategy: "css", value: "html > body > button" },
      { strategy: "text", value: "Submit" },
      { strategy: "testid", value: `[data-testid="go"]` },
    ]);
    expect(best).toEqual({ strategy: "testid", value: `[data-testid="go"]` });
  });

  it("prefers role over id when testid absent", () => {
    const best = pickBestSelector([
      { strategy: "css", value: "html > body > button" },
      { strategy: "id", value: "#submit" },
      { strategy: "role", value: "button" },
    ]);
    expect(best).toEqual({ strategy: "role", value: "button" });
  });

  it("prefers id over aria-label/name", () => {
    const best = pickBestSelector([
      { strategy: "aria-label", value: `[aria-label="Submit"]` },
      { strategy: "name", value: `[name="q"]` },
      { strategy: "id", value: "#go" },
    ]);
    expect(best).toEqual({ strategy: "id", value: "#go" });
  });

  it("falls back to aria-label then name then text then css", () => {
    const best = pickBestSelector([
      { strategy: "css", value: "body > button" },
      { strategy: "name", value: `[name="q"]` },
      { strategy: "aria-label", value: `[aria-label="Submit"]` },
    ]);
    expect(best?.strategy).toBe("aria-label");
  });

  it("falls back to css when nothing else is available", () => {
    const best = pickBestSelector([{ strategy: "css", value: "html > body > button" }]);
    expect(best).toEqual({ strategy: "css", value: "html > body > button" });
  });

  it("returns null for empty candidates", () => {
    expect(pickBestSelector([])).toBeNull();
  });

  it("ignores unknown strategies and falls back", () => {
    const best = pickBestSelector([
      { strategy: "xpath-future", value: "//button" },
      { strategy: "css", value: "body > button" },
    ]);
    expect(best).toEqual({ strategy: "css", value: "body > button" });
  });
});

describe("serializarPaso — priority end-to-end (HU-G14)", () => {
  function basePaso(over: Partial<PasoParaSerializar> = {}): PasoParaSerializar {
    return {
      id: "p1",
      numero: 1,
      tipo: "clic",
      descripcion: "Click en «Submit",
      selectorPrincipal: null,
      selectoresRespaldo: [],
      valor: null,
      esValorSensible: false,
      assertionKind: null,
      ...over,
    };
  }

  it("uses testid when present in respaldo", () => {
    const paso = basePaso({
      selectoresRespaldo: [
        { strategy: "testid", value: `[data-testid="submit"]` },
        { strategy: "css", value: "body > button" },
      ],
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.getByTestId(`[data-testid=\"submit\"]`).click();",
    );
  });

  it("emits getByRole when role is the best candidate", () => {
    const paso = basePaso({
      selectoresRespaldo: [{ strategy: "role", value: "button" }],
    });
    const code = serializarPaso(paso);
    // El método es getByRole y la primera estrategia priorizada es role.
    expect(code).toContain("getByRole(`button`");
  });

  it("uses id strategy → page.locator", () => {
    const paso = basePaso({
      selectoresRespaldo: [{ strategy: "id", value: "#submit" }],
    });
    expect(serializarPaso(paso)).toBe("  await page.locator(`#submit`).click();");
  });

  it("uses aria-label strategy → page.getByLabel", () => {
    const paso = basePaso({
      selectoresRespaldo: [{ strategy: "aria-label", value: "Submit" }],
    });
    expect(serializarPaso(paso)).toBe("  await page.getByLabel(`Submit`).click();");
  });

  it("uses text strategy → page.getByText", () => {
    const paso = basePaso({
      selectoresRespaldo: [{ strategy: "text", value: "Submit" }],
    });
    expect(serializarPaso(paso)).toBe("  await page.getByText(`Submit`).click();");
  });

  it("falls back to css when only css available", () => {
    const paso = basePaso({
      selectoresRespaldo: [{ strategy: "css", value: "html > body > button" }],
    });
    expect(serializarPaso(paso)).toBe(
      "  await page.locator(`html > body > button`).click();",
    );
  });

  it("prefers testid even when role is also available", () => {
    const paso = basePaso({
      selectoresRespaldo: [
        { strategy: "css", value: "body > button" },
        { strategy: "role", value: "button" },
        { strategy: "testid", value: `[data-testid="submit"]` },
    ],
    });
    const code = serializarPaso(paso);
    expect(code).toContain("getByTestId");
    expect(code).not.toContain("getByRole");
  });

  it("prefers role even when id is also available", () => {
    const paso = basePaso({
      selectoresRespaldo: [
        { strategy: "css", value: "body > button" },
        { strategy: "id", value: "#go" },
        { strategy: "role", value: "button" },
    ],
    });
    const code = serializarPaso(paso);
    expect(code).toContain("getByRole");
    expect(code).not.toContain("locator(`#go`");
  });
});

describe("serializarPaso — respaldo fallback chain (HU-G14)", () => {
  function basePaso(over: Partial<PasoParaSerializar> = {}): PasoParaSerializar {
    return {
      id: "p1",
      numero: 1,
      tipo: "clic",
      descripcion: "Click",
      selectorPrincipal: { tag: "button", testId: "x", aria: "Submit" },
      selectoresRespaldo: [],
      valor: null,
      esValorSensible: false,
      assertionKind: null,
      ...over,
    };
  }

  it("derives candidates from selectorPrincipal when respaldo is empty", () => {
    const paso = basePaso({
      selectorPrincipal: { tag: "button", testId: "go" },
      selectoresRespaldo: null,
    });
    const code = serializarPaso(paso);
    expect(code).toContain("getByTestId");
  });

  it("derives role candidate from selectorPrincipal when present", () => {
    const paso = basePaso({
      selectorPrincipal: { tag: "div", role: "button" },
      selectoresRespaldo: null,
    });
    const code = serializarPaso(paso);
    expect(code).toContain("getByRole(`button`");
  });

  it("falls back through chain: testid → role → id → aria → css", () => {
    // Cuando selectoresRespaldo es array, se usa SOLO esa lista.
    // role es el más prioritario de los disponibles → getByRole.
    const paso = basePaso({
      selectorPrincipal: { tag: "button", testId: "go" },
      selectoresRespaldo: [
        { strategy: "role", value: "button" },
        { strategy: "id", value: "#go" },
        { strategy: "css", value: "body > button" },
      ],
    });
    const code = serializarPaso(paso);
    expect(code).toContain("getByRole");
    // Pero NO debe usar el testid de selectorPrincipal (porque respaldo lo reemplaza).
    expect(code).not.toContain("getByTestId");
  });

  it("when respaldo is null, uses selectorPrincipal candidates in order", () => {
    const paso = basePaso({
      selectorPrincipal: { tag: "button", role: "button", testId: "go", aria: "Submit" },
      selectoresRespaldo: null,
    });
    const code = serializarPaso(paso);
    // testid está en la lista → getByTestId wins.
    expect(code).toContain("getByTestId");
  });
});