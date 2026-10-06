/**
 * Tests de lib/recorder/spec-builder.ts.
 *
 * Lo que se protege acá es la FIDELIDAD del archivo generado respecto de
 * lo que escribe `npx playwright codegen --target=playwright-test`. El
 * grabador entrega las líneas de acción ya formateadas e indentadas; lo
 * único nuestro es el envoltorio y el orden. Si esto se desvía, el caso
 * guardado deja de ser el script que el usuario vio grabar.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SPEC_FOOTER,
  SPEC_HEADER,
  SpecBuilder,
  ThrottledSpecFile,
  renderSpec,
} from "@/lib/recorder/spec-builder";

describe("recorder/spec-builder.renderSpec", () => {
  it("replica el envoltorio de codegen para el objetivo playwright-test", () => {
    expect(renderSpec([])).toBe(
      [
        "import { test, expect } from '@playwright/test';",
        "",
        "test('test', async ({ page }) => {",
        "});",
      ].join("\n"),
    );
  });

  it("intercala las acciones entre header y footer sin re-indentarlas", () => {
    // El grabador ya entrega las líneas con dos espacios de sangría
    // (JavaScriptFormatter con offset 2). Volver a indentarlas rompería
    // la fidelidad con el binario.
    const acciones = [
      "  await page.goto('https://example.com');",
      "  await page.getByRole('button', { name: 'Login' }).click();",
    ];
    expect(renderSpec(acciones)).toBe(
      [
        "import { test, expect } from '@playwright/test';",
        "",
        "test('test', async ({ page }) => {",
        "  await page.goto('https://example.com');",
        "  await page.getByRole('button', { name: 'Login' }).click();",
        "});",
      ].join("\n"),
    );
  });

  it("descarta las acciones de texto vacío en vez de dejar líneas en blanco", () => {
    // `openPage` y `closePage` generan "" cuando el objetivo es
    // playwright-test; codegen las filtra con `filter(Boolean)`.
    const out = renderSpec(["  await page.goto('https://x');", "", ""]);
    expect(out).toBe(
      [SPEC_HEADER, "  await page.goto('https://x');", SPEC_FOOTER].join("\n"),
    );
  });

  it("no agrega salto de línea final", () => {
    expect(renderSpec([]).endsWith("});")).toBe(true);
  });
});

describe("recorder/spec-builder.SpecBuilder", () => {
  it("agrega acciones nuevas al final", () => {
    const b = new SpecBuilder();
    b.add("  await page.goto('https://x');");
    b.add("  await page.getByLabel('Usuario').click();");
    expect(b.size).toBe(2);
    expect(b.render()).toContain("  await page.goto('https://x');");
    expect(b.render()).toContain("  await page.getByLabel('Usuario').click();");
  });

  it("una actualización reemplaza la última acción y no la duplica", () => {
    // Así colapsa el grabador el tecleo letra por letra en un solo `fill`.
    const b = new SpecBuilder();
    b.add("  await page.goto('https://x');");
    b.add("  await page.getByLabel('Usuario').fill('a');");
    b.update("  await page.getByLabel('Usuario').fill('an');");
    b.update("  await page.getByLabel('Usuario').fill('ana');");

    expect(b.size).toBe(2);
    const lineas = b.render().split("\n");
    const fills = lineas.filter((l) => l.includes(".fill("));
    expect(fills).toEqual(["  await page.getByLabel('Usuario').fill('ana');"]);
  });

  it("una actualización sin acciones previas se comporta como alta", () => {
    const b = new SpecBuilder();
    b.update("  await page.goto('https://x');");
    expect(b.size).toBe(1);
    expect(b.render()).toContain("await page.goto('https://x');");
  });

  it("la actualización cae sobre la acción correcta aunque haya textos vacíos", () => {
    // Las acciones de texto vacío se guardan igual para que el reemplazo
    // no se corra de posición; el filtrado ocurre al renderizar.
    const b = new SpecBuilder();
    b.add("  await page.goto('https://x');");
    b.add(""); // openPage
    b.update("  await page.getByRole('button').click();");

    expect(b.render()).toBe(
      [
        SPEC_HEADER,
        "  await page.goto('https://x');",
        "  await page.getByRole('button').click();",
        SPEC_FOOTER,
      ].join("\n"),
    );
  });
});

describe("recorder/spec-builder.ThrottledSpecFile", () => {
  let dir: string;

  beforeEach(() => {
    jest.useFakeTimers();
    dir = mkdtempSync(join(tmpdir(), "vxn-spec-builder-"));
  });

  afterEach(() => {
    jest.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it("escribe recién cuando vence la cadencia", () => {
    const path = join(dir, "out.spec.ts");
    const file = new ThrottledSpecFile(path, 250);
    file.setContent("primero");
    expect(() => readFileSync(path, "utf8")).toThrow();

    jest.advanceTimersByTime(250);
    expect(readFileSync(path, "utf8")).toBe("primero");
  });

  it("escribe una sola vez el último contenido tras varias actualizaciones", () => {
    const path = join(dir, "out.spec.ts");
    const file = new ThrottledSpecFile(path, 250);
    file.setContent("uno");
    file.setContent("dos");
    file.setContent("tres");

    jest.advanceTimersByTime(250);
    expect(readFileSync(path, "utf8")).toBe("tres");
  });

  it("flush escribe de inmediato, sin esperar el timer", () => {
    // Es el camino del cierre del navegador y del apagado ordenado: no hay
    // margen para esperar la cadencia.
    const path = join(dir, "out.spec.ts");
    const file = new ThrottledSpecFile(path, 250);
    file.setContent("final");
    file.flush();
    expect(readFileSync(path, "utf8")).toBe("final");
  });

  it("flush es idempotente y no reescribe si no hay nada pendiente", () => {
    const path = join(dir, "out.spec.ts");
    const file = new ThrottledSpecFile(path, 250);
    file.setContent("uno");
    file.flush();
    file.flush();
    expect(readFileSync(path, "utf8")).toBe("uno");
  });
});
