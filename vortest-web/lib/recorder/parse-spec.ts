// Convierte un .spec.ts de Playwright codegen en pasos estructurados (kind, rawText, selectorText, description); best-effort, nunca altera el spec persistido.

export interface SpecLine {
  /** Número de línea (base 1) en el spec.ts. */
  number: number;
  /** Texto crudo de la línea (trimmed); vacío si la línea es solo espacios. */
  rawText: string;
  /** Categoría de la acción. */
  kind: SpecLineKind;
  /** Selector legible extraído (puede estar vacío en goto/assertion). */
  selectorText: string;
  /** Descripción legible en español lista para la UI. */
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
  /** Si es true, las líneas en blanco se incluyen con rawText="" y kind="other" (por defecto false). */
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

  // await expect(...), con .not y expect.soft; el matcher se captura genérico (\w+)
  m = trimmed.match(/^await\s+expect(\.soft)?\((.+)\)\.(not\.)?(\w+)\((.*?)\)\s*;?$/);
  if (m) {
    const selector = humanizePlaywrightArg(m[2] ?? "");
    const negated = !!m[3];
    const matcher = m[4] ?? "";
    const args = m[5] ?? "";
    return {
      ...fallback,
      kind: "assertion",
      selectorText: selector,
      description: `Verificar ${negated ? "que NO " : ""}${humanizeMatcher(matcher)} de ${selector}${args ? ` (${args})` : ""}`,
    };
  }

  // .click(), puede tener cadena de selectores antes
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

  // Cualquier await suelto (page.goto, page.locator, etc.)
  if (trimmed.startsWith("await ")) {
    return { ...fallback, kind: "navigate", description: trimmed };
  }

  return fallback;
}

/** Convierte un selector Playwright crudo a una versión legible para el panel (getByRole, getByLabel, getByText, getByTestId, locator). */
function humanizePlaywrightArg(arg: string): string {
  let s = arg.trim();
  if (!s) return "<desconocido>";

  // Quita .first() / .nth(N) del final antes de matchear
  s = s.replace(/\.(?:first|nth\(\d+\))\s*$/, "");

  // Si es `page.X(...)` se trabaja sobre `X(...)` para no confundir las regex siguientes
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
  /^sk_(live|test)_/i, // tipo Stripe
  /bearer\s/i,
];
const SECRET_SELECTOR_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[-_]?key/i,
  /credential/i,
];

/** Enmascara valores que parecen credenciales, por su contenido o por el selector (label, name, testid). */
function maskSecretValue(value: string, selectorText: string): string {
  if (SECRET_VALUE_PATTERNS.some((re) => re.test(value))) return "••••••";
  if (SECRET_SELECTOR_PATTERNS.some((re) => re.test(selectorText))) {
    return "••••••";
  }
  return value;
}

// Traducciones de los matchers de `expect(locator/page/response)`; uno desconocido cae al `default` y sigue clasificado como "assertion".
function humanizeMatcher(matcher: string): string {
  switch (matcher) {
    // Locator: visibilidad / estado
    case "toBeVisible":
      return "visibilidad";
    case "toBeHidden":
      return "ocultamiento";
    case "toBeAttached":
      return "que esté en el DOM";
    case "toBeChecked":
      return "que esté marcado";
    case "toBeDisabled":
      return "que esté deshabilitado";
    case "toBeEditable":
      return "que sea editable";
    case "toBeEmpty":
      return "que esté vacío";
    case "toBeEnabled":
      return "que esté habilitado";
    case "toBeFocused":
      return "que tenga foco";
    case "toBeInViewport":
      return "que esté en el viewport";
    // Locator: contenido / atributos
    case "toContainText":
      return "que contenga texto";
    case "toContainClass":
      return "clase CSS";
    case "toHaveAccessibleDescription":
      return "descripción accesible";
    case "toHaveAccessibleErrorMessage":
      return "mensaje de error accesible";
    case "toHaveAccessibleName":
      return "nombre accesible";
    case "toHaveAttribute":
      return "atributo";
    case "toHaveClass":
      return "clase CSS";
    case "toHaveCount":
      return "cantidad de elementos";
    case "toHaveCSS":
      return "estilo CSS";
    case "toHaveId":
      return "id";
    case "toHaveJSProperty":
      return "propiedad JS";
    case "toHaveRole":
      return "rol ARIA";
    case "toHaveScreenshot":
      return "captura visual";
    case "toHaveText":
      return "texto";
    case "toHaveValue":
      return "valor";
    case "toHaveValues":
      return "valores";
    case "toMatchAriaSnapshot":
      return "snapshot de accesibilidad";
    // Page
    case "toHaveTitle":
      return "título de la página";
    case "toHaveURL":
      return "URL";
    // API response
    case "toBeOK":
      return "que la respuesta sea OK";
    // Genéricos (expect(valor).toX(...) sobre datos, no locators)
    case "toBe":
      return "igualdad estricta";
    case "toEqual":
      return "igualdad";
    case "toBeTruthy":
      return "que sea verdadero";
    case "toBeFalsy":
      return "que sea falso";
    case "toBeNull":
      return "que sea null";
    case "toBeDefined":
      return "que esté definido";
    case "toBeUndefined":
      return "que sea undefined";
    case "toBeGreaterThan":
      return "que sea mayor a";
    case "toBeGreaterThanOrEqual":
      return "que sea mayor o igual a";
    case "toBeLessThan":
      return "que sea menor a";
    case "toBeLessThanOrEqual":
      return "que sea menor o igual a";
    case "toBeCloseTo":
      return "que sea aproximadamente";
    case "toContain":
      return "que contenga";
    case "toMatch":
      return "que coincida con";
    case "toMatchObject":
      return "que coincida con el objeto";
    case "toPass":
      return "que pase (retry)";
    default:
      return matcher;
  }
}

/** Filtra solo los pasos no triviales (sin imports, llaves ni líneas en blanco) para el `PasoPanel`. */
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
