// Ensambla el `.spec.ts` a partir de las acciones del grabador de Playwright, replicando carácter por carácter el envoltorio de `generateCode`; sin reindentar ni decorar.

import { writeFileSync } from "node:fs";

/** Header exacto del objetivo `playwright-test` sin device ni contextOptions. */
export const SPEC_HEADER =
  "import { test, expect } from '@playwright/test';\n\ntest('test', async ({ page }) => {";

/** Footer exacto del objetivo `playwright-test`. */
export const SPEC_FOOTER = "});";

/** Une header + acciones + footer como `generateCode` de Playwright; descarta las acciones vacías. */
export function renderSpec(actionTexts: readonly string[]): string {
  return [SPEC_HEADER, ...actionTexts.filter(Boolean), SPEC_FOOTER].join("\n");
}

/** Acumulador de acciones: `actionAdded` agrega y `actionUpdated` reemplaza la última; las de texto vacío se guardan y se filtran al renderizar. */
export class SpecBuilder {
  private readonly _actionTexts: string[] = [];

  /** Agrega una acción nueva al final. */
  add(code: string): void {
    this._actionTexts.push(code);
  }

  /** Reemplaza la última acción; si no hay ninguna se comporta como `add`. */
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

/** Escritor con la misma cadencia que `ThrottledFile` de Playwright (250 ms); `flush()` es síncrono e idempotente, para el cierre y el apagado. */
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
      // No mantener vivo el proceso solo por este timer
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
