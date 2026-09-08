/**
 * parse-spec.ts — convierte el contenido de un .spec.ts generado por
 * Playwright codegen en pasos estructurados para el panel derecho del
 * modo grabador.
 *
 * Política ZERO modificación: lo que parseamos es lo que `npx playwright
 * codegen` emite. Si codegen cambia su formato, este parser se actualiza
 * para reflejarlo — nunca altera el spec.ts persistido.
 *
 * Estructura devuelta por linea no-trivial:
 *   - `kind: "goto"`           → page.goto(URL)
 *   - `kind: "click"`          → page.getByRole(...) / getByText / locator / getByLabel
 *   - `kind: "fill"`           → .fill(...) / .type(...)
 *   - `kind: "press"`          → .press(...)
 *   - `kind: "check"`          → .check() / .uncheck()
 *   - `kind: "select"`         → .selectOption(...)
 *   - `kind: "hover"`          → .hover() / hover()
 *   - `kind: "assertion"`      → expect(...).toBeVisible / toHaveText / etc
 *   - `kind: "other"`          → cualquier otra cosa
 *
 * `rawText` siempre está (la línea completa sin trim).
 * `selectorText` es la parte del selector legible para el QA
 *   ("getByRole('button', { name: 'Iniciar sesión' })").
 * `description` es la descripción legible en español lista para la UI
 *   ("Click en «Iniciar sesión»", "Verificar visibilidad de «Carrito»",
 *    "Ir a https://example.com/login", etc.).
 *
 * El parser es "best-effort" — falla nunca. Si no entiende una línea,
 * la expone como kind: "other" con su rawText.
 */

export interface SpecLine {
  /** 1-indexed line number en el spec.ts. */
  number: number;
  /** Texto crudo de la línea (trimmed). Vacío si la línea es whitespace puro. */
  rawText: string;
  /** Categoría de la acción. */
  kind: SpecLineKind;
  /** Selector legible extraído (puede estar vacío en goto/assertion). */
  selectorText: string;
  /** Descripción legible en español lista para UI. */
  description: string;
}

export type SpecLineKind =
  | "import"
  | "test-header"
  | "goto"
  | "click"
  | "fill"
  | "press"
  | "check"
  | "select"
  | "hover"
  | "assertion"
  | "navigate"
  | "comment"
  | "other";

export interface ParseSpecOptions {
  /** Si true, líneas con whitespace puro se incluyen como rawText="" y kind="other". Default false. */
  includeEmpty?: boolean;
}

export function parseSpec(
  content: string,
  options: ParseSpecOptions = {},
): SpecLine[] {
  const lines = content.split(/\r?\n/);
  const result: SpecLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed === "" && !options.includeEmpty) continue;
    result.push(parseLine(i + 1, trimmed, lines[i] ?? ""));
  }
  return result;
}

function parseLine(number: number, trimmed: string, raw: string): SpecLine {
  const fallback: SpecLine = {
    number,
    rawText: trimmed,
    kind: "other",
    selectorText: "",
    description: trimmed || "",
  };

  if (trimmed === "") return { ...fallback, rawText: "", description: "" };
  if (trimmed.startsWith("import ")) {
    return { ...fallback, kind: "import", description: trimmed };
  }
  if (
    /^test\(/.test(trimmed) &&
    /async\s*\(\s*\{[^}]*\}\s*\)\s*=>/.test(trimmed)
  ) {
    return { ...fallback, kind: "test-header", description: trimmed };
  }
  if (trimmed.startsWith("//")) {
    return { ...fallback, kind: "comment", description: trimmed };
  }

  // await page.goto("https://example.com/login")
  let m = trimmed.match(/^await\s+page\.goto\((['"`])([^'"`]+)\1\)\s*;?$/);
  if (m) {
    return {
      ...fallback,
      kind: "goto",
      selectorText: m[2] ?? "",
      description: `Ir a ${m[2]}`,
    };
  }

  // await expect(page.getByRole(...)).toBeVisible();
  // await expect(page.getByText('...')).toHaveText('...');
  m = trimmed.match(/^await\s+expect\((.+)\)\.(\w+)\((.*?)\)\s*;?$/);
  if (m) {
    const selector = humanizePlaywrightArg(m[1] ?? "");
    const matcher = m[2] ?? "";
    const args = m[3] ?? "";
    return {
      ...fallback,
      kind: "assertion",
      selectorText: selector,
      description: `Verificar ${humanizeMatcher(matcher)} de ${selector}${args ? ` (${args})` : ""}`,
    };
  }

  // .click() — puede tener selector chain antes
  m = trimmed.match(/^await\s+(.+?)\.click\(([^)]*)\)\s*;?$/);
  if (m) {
    const selector = humanizePlaywrightArg(m[1] ?? "");
    return {
      ...fallback,
      kind: "click",
      selectorText: selector,
      description: `Click en ${selector}`,
    };
  }

  // .fill("texto") / .type("texto")
  m = trimmed.match(/^await\s+(.+?)\.(fill|type)\((['"`])([^'"`]+)\3\)\s*;?$/);
  if (m) {
    const selector = humanizePlaywrightArg(m[1] ?? "");
    const action = m[2] === "fill" ? "Completar" : "Tipear";
    const value = m[4] ?? "";
    const masked = maskSecretValue(value, selector);
    return {
      ...fallback,
      kind: "fill",
      selectorText: selector,
      description: `${action} ${selector} con «${masked}»`,
    };
  }

  // .press("Enter")
  m = trimmed.match(/^await\s+(.+?)\.press\((['"`])([^'"`]+)\2\)\s*;?$/);
  if (m) {
    const selector = humanizePlaywrightArg(m[1] ?? "");
    return {
      ...fallback,
      kind: "press",
      selectorText: selector,
      description: `Press ${m[3]} en ${selector}`,
    };
  }

  // .check() / .uncheck()
  m = trimmed.match(/^await\s+(.+?)\.(check|uncheck)\((.*?)\)\s*;?$/);
  if (m) {
    const selector = humanizePlaywrightArg(m[1] ?? "");
    const verb = m[2] === "check" ? "Marcar" : "Desmarcar";
    return {
      ...fallback,
      kind: "check",
      selectorText: selector,
      description: `${verb} ${selector}`,
    };
  }

  // .selectOption(...)
  m = trimmed.match(/^await\s+(.+?)\.selectOption\((.+?)\)\s*;?$/);
  if (m) {
    const selector = humanizePlaywrightArg(m[1] ?? "");
    const opts = m[2] ?? "";
    return {
      ...fallback,
      kind: "select",
      selectorText: selector,
      description: `Seleccionar opción en ${selector} (${opts})`,
    };
  }

  // .hover()
  m = trimmed.match(/^await\s+(.+?)\.hover\(([^)]*)\)\s*;?$/);
  if (m) {
    const selector = humanizePlaywrightArg(m[1] ?? "");
    return {
      ...fallback,
      kind: "hover",
      selectorText: selector,
      description: `Hover sobre ${selector}`,
    };
  }

  // await page.goto, await page.locator, etc — cualquier await suelto
  if (trimmed.startsWith("await ")) {
    return { ...fallback, kind: "navigate", description: trimmed };
  }

  return fallback;
}

/**
 * Convierte un selector Playwright crudo a una versión legible para mostrar
 * en el panel derecho. Maneja las formas comunes que emite codegen:
 *   - page.getByRole('button', { name: 'Iniciar sesión' })
 *   - page.getByLabel('Email')
 *   - page.getByText('Continue')
 *   - page.getByTestId('submit')
 *   - page.locator('css-selector')
 *   - page.locator('#id').first()
 */
function humanizePlaywrightArg(arg: string): string {
  let s = arg.trim();
  if (!s) return "<desconocido>";

  // Limpia .first() / .nth(N) del final antes de cualquier match
  s = s.replace(/\.(?:first|nth\(\d+\))\s*$/, "");

  // Si es `page.X(...)`, trabajamos sobre `X(...)` para que las regex
  // siguientes no se confundan con el prefijo `page.`.
  const inner =
    s.startsWith("page.") && /\(.*\)\s*$/.test(s) ? s.slice("page.".length) : s;

  // getByRole('button', { name: 'Iniciar sesión' })
  let m = inner.match(
    /^getByRole\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{\s*name:\s*['"`]([^'"`]+)['"`](?:\s*,[^}]*)?\s*\}\s*\)$/,
  );
  if (m) {
    return `getByRole('${m[1]}', { name: '${m[2]}' })`;
  }

  // getByLabel / getByText / getByTestId / getByPlaceholder / getByAltText
  m = inner.match(
    /^getBy(?:Label|Text|TestId|Placeholder|AltText)\(\s*['"`]([^'"`]+)['"`]\s*\)$/,
  );
  if (m) {
    const kindMatch = inner.match(/^getBy(\w+)\(/);
    const kind = kindMatch?.[1] ?? "";
    return `getBy${kind}('${m[1]}')`;
  }

  // locator('css') con o sin chaining final
  m = inner.match(/^locator\(\s*['"`]([^'"`]+)['"`]/);
  if (m) {
    return `locator('${m[1]}')`;
  }

  return inner;
}

const SECRET_VALUE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /^sk_(live|test)_/i, // Stripe-like
  /bearer\s/i,
];
const SECRET_SELECTOR_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /credential/i,
];

/**
 * Enmascara valores que parecen credenciales — tanto por el contenido del
 * valor como por el selector (label, name, testid). Si el QA tipea
 * "super-secret-123" en cualquier lugar, lo enmascaramos. Si tipea
 * algo que parece secreto dentro de un campo "Password", también.
 */
function maskSecretValue(value: string, selectorText: string): string {
  if (SECRET_VALUE_PATTERNS.some((re) => re.test(value))) return "••••••";
  if (SECRET_SELECTOR_PATTERNS.some((re) => re.test(selectorText))) {
    return "••••••";
  }
  return value;
}

function humanizeMatcher(matcher: string): string {
  switch (matcher) {
    case "toBeVisible":
      return "visibilidad";
    case "toBeHidden":
      return "ocultamiento";
    case "toHaveText":
      return "texto";
    case "toHaveValue":
      return "valor";
    case "toContainText":
      return "contenga";
    case "toBeChecked":
      return "que esté marcado";
    case "toBeDisabled":
      return "que esté deshabilitado";
    case "toBeEnabled":
      return "que esté habilitado";
    case "toBeEmpty":
      return "que esté vacío";
    default:
      return matcher;
  }
}

/**
 * Helper que filtra solo los pasos no triviales (skip imports, brackets,
 * whitespace) para alimentar al `PasoPanel`.
 */
export function parseSpecToSteps(content: string): SpecLine[] {
  return parseSpec(content).filter(
    (line) =>
      line.kind !== "import" &&
      line.kind !== "test-header" &&
      line.kind !== "comment" &&
      line.kind !== "other" &&
      line.rawText !== "",
  );
}
