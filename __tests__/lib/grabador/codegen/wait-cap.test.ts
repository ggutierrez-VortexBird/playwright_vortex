/**
 * Tests para el cap de `esperar` en el codegen
 * (`lib/grabador/codegen/serialize.ts` → `MAX_WAIT_PERSIST_MS = 1500`).
 *
 * Si llega un wait >1500ms al codegen, debe SKIP el `waitForTimeout`
 * entero (comentario explicativo). Esto matchea lo que hace
 * `playwright codegen` — waits grandes son ruido porque Playwright
 * ya tiene auto-wait built-in.
 */

import {
  serializarPaso,
  type PasoParaSerializar,
} from "@/lib/grabador/codegen/serialize";

function waitPaso(valor: string, numero = 1): PasoParaSerializar {
  return {
    id: `p${numero}`,
    numero,
    tipo: "esperar",
    descripcion: `Esperar ${(parseInt(valor, 10) / 1000).toFixed(1)}s`,
    selectorPrincipal: null,
    selectoresRespaldo: [],
    valor,
    esValorSensible: false,
    assertionKind: null,
  };
}

describe("codegen — wait cap (esperar > MAX_WAIT_PERSIST_MS)", () => {
  it("emits waitForTimeout for 1000ms (under cap)", () => {
    expect(serializarPaso(waitPaso("1000"))).toBe(
      "  await page.waitForTimeout(1000);",
    );
  });

  it("emits waitForTimeout for exactly 1500ms (cap inclusive)", () => {
    expect(serializarPaso(waitPaso("1500"))).toBe(
      "  await page.waitForTimeout(1500);",
    );
  });

  it("emits a SKIP comment for 1501ms (just over cap)", () => {
    const out = serializarPaso(waitPaso("1501")) ?? "";
    expect(out).toContain("//");
    expect(out).toContain("1501");
    expect(out).toContain("omitido");
    expect(out).not.toContain("waitForTimeout(1501");
  });

  it("emits a SKIP comment for 13000ms (the wikipedia scenario)", () => {
    const out = serializarPaso(waitPaso("13000")) ?? "";
    expect(out).toContain("// Paso 1:");
    expect(out).toContain("esperar");
    expect(out).toContain("13000");
    expect(out).toContain("omitido");
    expect(out).toContain(">1500ms");
  });

  it("emits waitForTimeout for 100ms (very short)", () => {
    expect(serializarPaso(waitPaso("100"))).toBe(
      "  await page.waitForTimeout(100);",
    );
  });

  it("falls back to 1000ms when valor is unparseable", () => {
    expect(serializarPaso(waitPaso("not-a-number"))).toBe(
      "  await page.waitForTimeout(1000);",
    );
  });
});
