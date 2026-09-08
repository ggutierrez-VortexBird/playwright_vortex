/**
 * selector-lint.ts — detecta selectores genéricos y frágiles en un
 * `.spec.ts` grabado.
 *
 * Contexto: el grabador de Playwright (el mismo mecanismo que usa
 * `npx playwright codegen`, propio o vía `_enableRecorder`) resuelve el
 * elemento clickeado consultando el DOM en el momento del evento. En
 * algunos sitios, el propio JS de la página empieza a navegar o a
 * re-renderizar el widget en `mousedown` — ANTES de que el gesto de click
 * termine — y el recorder pierde esa carrera: el documento que consulta ya
 * cambió, y cae a un selector genérico tipo `page.locator('div').first()`
 * en vez de uno robusto por rol/texto. Esto le puede pasar igual al
 * binario oficial; no es específico de este proyecto, y no hay forma de
 * evitarlo desde acá sin cambiar el timing del sitio grabado.
 *
 * Lo que sí se puede hacer es avisar: una línea así queda silenciosa en el
 * script guardado y es la más propensa a romperse con el mínimo cambio de
 * layout. Este módulo la señala para que el usuario la revise a mano antes
 * de guardar el caso.
 */

/** Selector CSS de una etiqueta HTML sin ningún calificador (id, clase,
 * atributo, texto): `div`, `span`, `a`, `li`... seguido de `.first()`,
 * `.last()` o `.nth(N)`, que es la forma en la que el recorder resuelve
 * "el elemento que sea" cuando perdió la referencia al target real. */
const FRAGILE_LOCATOR = /page\.locator\((['"])([a-zA-Z][\w-]*)\1\)\.(?:first|last)\(\)|page\.locator\((['"])([a-zA-Z][\w-]*)\3\)\.nth\(\d+\)/;

export interface FragileSelectorWarning {
  /** Número de línea 1-indexado dentro del specCode dado. */
  line: number;
  /** Contenido de la línea, sin espacios de sangría. */
  text: string;
}

/**
 * Recorre el spec línea por línea y devuelve las que usan un selector
 * genérico de etiqueta + `.first()/.last()/.nth()`.
 */
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
