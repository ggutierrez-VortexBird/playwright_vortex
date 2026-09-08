/**
 * spec-builder.ts — ensambla el `.spec.ts` a partir de las acciones que
 * emite el grabador de Playwright en modo programático.
 *
 * Contexto (ACTA — Grabador sin Inspector):
 *   El binario `npx playwright codegen` siempre abre la ventana del
 *   Playwright Inspector y no expone bandera para desactivarla. En su
 *   lugar activamos el MISMO grabador vía `context._enableRecorder` con
 *   `recorderMode: "api"`, que no crea ninguna ventana y entrega cada
 *   acción ya convertida en la línea de código que codegen escribiría.
 *
 *   Lo único que queda de nuestro lado es el envoltorio del archivo. Este
 *   módulo lo replica CARÁCTER POR CARÁCTER respecto de lo que hace
 *   Playwright 1.62.1 internamente (`generateCode` en
 *   playwright-core/lib/coreBundle.js:26286):
 *
 *     const text = [header, ...actionTexts.filter(Boolean), footer].join("\n")
 *
 *   con el header de `JavaScriptLanguageGenerator.generateTestHeader`
 *   (objetivo `playwright-test`, sin device ni contextOptions):
 *
 *     import { test, expect } from '@playwright/test';
 *     <línea en blanco>
 *     test('test', async ({ page }) => {
 *
 *   y el footer `});`.
 *
 * Política ZERO modificación: las líneas de acción llegan YA indentadas
 * con dos espacios (el generador usa `new JavaScriptFormatter(2)`), así
 * que este módulo NO las re-indenta, NO las reordena y NO las decora.
 */

import { writeFileSync } from "node:fs";

/** Header exacto del objetivo `playwright-test` sin device ni contextOptions. */
export const SPEC_HEADER =
  "import { test, expect } from '@playwright/test';\n\ntest('test', async ({ page }) => {";

/** Footer exacto del objetivo `playwright-test`. */
export const SPEC_FOOTER = "});";

/**
 * Une header + acciones + footer igual que `generateCode` de Playwright.
 *
 * Las acciones vacías se descartan (`filter(Boolean)`): el generador
 * devuelve `""` para `openPage`/`closePage` cuando el objetivo es
 * `playwright-test`, y esas entradas no deben dejar líneas en blanco.
 */
export function renderSpec(actionTexts: readonly string[]): string {
  return [SPEC_HEADER, ...actionTexts.filter(Boolean), SPEC_FOOTER].join("\n");
}

/**
 * Acumulador de acciones.
 *
 * El grabador emite dos eventos distintos sobre la misma acción:
 *   - `actionAdded`: una acción nueva → se agrega al final.
 *   - `actionUpdated`: la acción en curso cambió y REEMPLAZA a la última
 *     (así es como el tecleo letra por letra colapsa en un solo `fill`).
 *
 * Se guardan también las acciones que generan texto vacío, para que el
 * reemplazo de `actionUpdated` caiga siempre sobre la entrada correcta.
 * El filtrado ocurre recién al renderizar.
 */
export class SpecBuilder {
  private readonly _actionTexts: string[] = [];

  /** Agrega una acción nueva al final. */
  add(code: string): void {
    this._actionTexts.push(code);
  }

  /**
   * Reemplaza la última acción. Si todavía no hay ninguna, se comporta
   * como `add` — no debería ocurrir, pero perder la línea sería peor que
   * agregarla.
   */
  update(code: string): void {
    if (this._actionTexts.length === 0) {
      this._actionTexts.push(code);
      return;
    }
    this._actionTexts[this._actionTexts.length - 1] = code;
  }

  /** Cantidad de acciones acumuladas, incluidas las de texto vacío. */
  get size(): number {
    return this._actionTexts.length;
  }

  /** Contenido completo del `.spec.ts` en este momento. */
  render(): string {
    return renderSpec(this._actionTexts);
  }
}

/**
 * Escritor con la misma cadencia que usa Playwright para su `--output`
 * (`ThrottledFile`, 250 ms). Se replica el intervalo para que el vigilante
 * del recorder-worker vea exactamente el mismo patrón de escrituras que
 * con el binario.
 *
 * `flush()` es síncrono y idempotente: se llama al cerrarse el navegador
 * y en el apagado ordenado, donde no hay margen para esperar un timer.
 */
export class ThrottledSpecFile {
  private _pending: string | undefined;
  private _timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly _path: string,
    private readonly _delayMs: number = 250,
  ) {}

  setContent(text: string): void {
    this._pending = text;
    if (!this._timer) {
      this._timer = setTimeout(() => this.flush(), this._delayMs);
      // No mantener vivo el proceso solo por este timer.
      this._timer.unref?.();
    }
  }

  flush(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = undefined;
    }
    if (this._pending === undefined) return;
    const text = this._pending;
    this._pending = undefined;
    writeFileSync(this._path, text, "utf8");
  }
}
