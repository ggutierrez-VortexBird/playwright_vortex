/** Detecta selectores genéricos y frágiles en un `.spec.ts` grabado, para que el usuario los revise antes de guardar. */

/** Selector de etiqueta HTML sin calificadores (`div`, `span`...) seguido de `.first()`, `.last()` o `.nth(N)`. */
const FRAGILE_LOCATOR = /page\.locator\((['"])([a-zA-Z][\w-]*)\1\)\.(?:first|last)\(\)|page\.locator\((['"])([a-zA-Z][\w-]*)\3\)\.nth\(\d+\)/;

export interface FragileSelectorWarning {
  /** Número de línea 1-indexado dentro del specCode dado. */
  line: number;
  /** Contenido de la línea, sin espacios de sangría. */
  text: string;
}

/** Devuelve las líneas del spec con selector genérico de etiqueta + `.first()/.last()/.nth()`. */
export function findFragileSelectors(specCode: string): FragileSelectorWarning[] {
  if (!specCode) return [];
  const warnings: FragileSelectorWarning[] = [];
  const lines = specCode.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (FRAGILE_LOCATOR.test(line)) {
      warnings.push({ line: i + 1, text: line.trim() });
    }
  }
  return warnings;
}
