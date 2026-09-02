/**
 * codegen/serialize.ts — convierte una lista de PasoGrabado en el source
 * de un archivo .spec.ts de Playwright.
 *
 * HU-G11 forward-port: la generación del script es la primera mitad del
 * "Guardar caso" (HU-G16). Esta función es pura — recibe los pasos y
 * parámetros, retorna el string TypeScript listo para escribir a disco.
 *
 * Vocabulary (debe coincidir con el reporter):
 *   navegar   → page.goto(url)
 *   clic      → page.<strategy>(selector).click()
 *   escribir  → page.<strategy>(selector).fill(valor)
 *   esperar   → page.waitForTimeout(ms)
 *   verificar → expect(page.<strategy>(selector)).<assertion>(esperado)
 *
 * HU-G14 — Selector priority (HU-G14):
 *   testid > role > id > aria-label > name > text > css
 *   Implementada en `pickBestSelector` de lib/grabador/dom-utils.ts.
 *   El serializador consume `selectoresRespaldo` del paso (lista de
 *   `{ strategy, value }` ordenada por preferencia) y `pickBestSelector`
 *   resuelve el primero que aparezca en la priority list. Si ninguno
 *   matchea, emitimos un comentario "// sin selector — revisar".
 *
 * Param substitution:
 *   - Si un paso tiene `valor` que matchea el nombre de un parametro
 *     (búsqueda por coincidencia con el chip {{nombre}}), se sustituye
 *     en el script final por `params.nombre`.
 *   - Si un paso `navegar` tiene URL que contiene {{param}}, lo mismo.
 */

import {
  pickBestSelector,
  type SerializedElementFull,
} from "@/lib/grabador/dom-utils";

/** Forma mínima que el serializer necesita de un PasoGrabado. */
export interface PasoParaSerializar {
  id: string;
  numero: number;
  tipo: string;
  descripcion: string;
  selectorPrincipal: unknown;
  selectoresRespaldo: unknown;
  valor: string | null;
  esValorSensible: boolean;
  assertionKind: string | null;
}

export interface ParametroParaSerializar {
  nombre: string;
  valorDefecto: string | null;
}

export interface SerializarPasosOptions {
  nombreDelCaso: string;
  /** Nombre del responsable (default "qa-team"). */
  responsable?: string;
  /** Params opcionales — sustituidos en {{nombre}} en cualquier string del paso. */
  parametros?: ParametroParaSerializar[];
  /** Indentación por defecto: 2 spaces. */
  indent?: string;
}

const TYPE_STRATEGY_FALLBACK = "locator";

/**
 * Convierte `selectoresRespaldo` (que es lo persistido por el init-script
 * como JSON) a la forma `SerializedElementFull.candidates` que `pickBestSelector`
 * espera. Si no hay selectores de respaldo, intenta derivarlos de selectorPrincipal.
 *
 * HU-G14: el orden de los candidates en el array afecta el resultado de
 * `pickBestSelector` solo cuando hay empate de estrategia; para
 * prioridades distintas, gana la estrategia más prioritaria sin importar
 * la posición.
 */
function candidatesFromPaso(paso: PasoParaSerializar): Array<{ strategy: string; value: string }> {
  const respaldo = paso.selectoresRespaldo;
  if (Array.isArray(respaldo)) {
    return respaldo.filter(
      (c): c is { strategy: string; value: string } =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as { strategy?: unknown }).strategy === "string" &&
        typeof (c as { value?: unknown }).value === "string",
    );
  }
  // Fallback: build candidates from selectorPrincipal primitives.
  if (
    typeof paso.selectorPrincipal === "object" &&
    paso.selectorPrincipal !== null
  ) {
    const sp = paso.selectorPrincipal as {
      tag?: string;
      role?: string;
      testId?: string;
      aria?: string;
      text?: string;
    };
    const candidates: Array<{ strategy: string; value: string }> = [];
    if (sp.testId) {
      candidates.push({
        strategy: "testid",
        value: `[data-testid="${sp.testId}"]`,
      });
    }
    if (sp.role) {
      candidates.push({ strategy: "role", value: sp.role });
    }
    if (sp.aria) {
      candidates.push({
        strategy: "aria-label",
        value: `[aria-label="${sp.aria}"]`,
      });
    }
    if (sp.text) {
      candidates.push({
        strategy: "text",
        value: sp.text,
      });
    }
    return candidates;
  }
  return [];
}

/**
 * Devuelve el page.<strategy>() method name para Playwright, basado en
 * el candidate.strategy.
 */
function playwrightMethodFor(strategy: string): string {
  switch (strategy) {
    case "testid":
      return "getByTestId";
    case "role":
      return "getByRole";
    case "id":
      return "locator";
    case "aria-label":
      return "getByLabel";
    case "name":
      return "locator";
    case "text":
      return "getByText";
    case "css":
    default:
      return TYPE_STRATEGY_FALLBACK;
  }
}

/**
 * Devuelve el argumento al locator method.
 *
 * Bug fix: antes esto era un no-op (default: return value) y mandaba el
 * selector literal completo a Playwright. Por ejemplo:
 *   playwrightArgFor("aria-label", `[aria-label="username"]`)
 *     -> antes: `[aria-label="username"]`
 *     -> ahora: `username`
 *
 * getByLabel / getByTestId esperan SOLO el valor (texto del label /
 * valor del data-testid), NO el selector completo. Si le pasas el
 * wrapper, Playwright intenta matchear un label cuyo texto es literalmente
 * `[aria-label="username"]` y nunca lo encuentra — el test falla con
 * timeout esperando el locator.
 *
 * Para id / name / css / role / text el value ya viene en el formato
 * correcto para page.locator() o page.getByRole/getByText, asi que se
 * pasan sin modificar.
 */
function playwrightArgFor(strategy: string, value: string): string {
  switch (strategy) {
    case "testid": {
      // value: [data-testid="foo"] -> foo
      const m = value.match(/^\[data-testid="([^"]+)"\]$/);
      return m ? m[1]! : value;
    }
    case "aria-label": {
      // value: [aria-label="foo"] -> foo
      const m = value.match(/^\[aria-label="([^"]+)"\]$/);
      return m ? m[1]! : value;
    }
    case "id":
    case "name":
    case "css":
    case "text":
    case "role":
    default:
      // locator('#id'), locator('[name="x"]'), locator('html > body > ...'),
      // getByText('Welcome'), getByRole('button') — value ya esta bien.
      return value;
  }
}

/**
 * Para strategies que necesitan opciones (ej. role → { name: 'Ingresar' }),
 * devuelve el sufijo del locator call. Cadena vacía si no aplica.
 *
 * Extrae el nombre del elemento de la descripcion (formato "Clic en
 * «name»" / "Escribir «x» en «name»") para que el codegen emita
 * `getByRole('button', { name: 'Ingresar' })` igual que Playwright.
 */
function playwrightRoleOptionsFor(
  paso: { tipo: string; valor: string | null; descripcion: string },
  roleValue: string,
): string {
  if (paso.tipo === "navegar") return "";
  // Intentar extraer el nombre del elemento de la descripcion.
  // Formatos: "Clic en «NAME»", "Escribir «x» en «NAME»", "Tecla en «NAME»"
  const m = paso.descripcion.match(/«([^»]+)»/);
  let name = m && m[1] ? m[1].trim() : "";
  // Fallback: valor si existe
  if (!name && paso.valor) name = paso.valor.trim();
  if (!name) return "";
  // Limpiar prefijos comunes del name (ej "Clic en " si no se pudo parsear)
  name = name.replace(/^(Clic en|Tecla en)\s+/i, "").trim();
  if (!name) return "";
  return `, { name: \`${jsStringEscape(name.slice(0, 50))}\` }`;
}

/** Template literal-safe: escapa backticks y ${ en strings. */
function jsStringEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

/** Si `s` contiene {{param}}, devuelve el nombre del primer param. */
function findParamRef(
  s: string,
  parametros: ParametroParaSerializar[],
): string | null {
  for (const p of parametros) {
    if (s.includes(`{{${p.nombre}}}`)) return p.nombre;
  }
  return null;
}

/** Sustituye {{nombre}} por `params.nombre` en una string para inline-eval. */
function inlineParamRef(s: string): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, name: string) => `\${params.${name}}`);
}

/**
 * Construye el `params` literal al inicio del test body. Para cada
 * parametro, evalúa `params.nombre` en runtime (no en compile time) para
 * no exponer el valor en el source.
 */
function buildParamsObject(parametros: ParametroParaSerializar[]): string {
  if (parametros.length === 0) return "{}";
  const lines = parametros.map((p) => {
    const val = p.valorDefecto ?? "";
    // Use a JSON.stringify so special chars are escaped correctly.
    const json = JSON.stringify(val);
    return `  ${p.nombre}: ${json},`;
  });
  return `{\n${lines.join("\n")}\n}`;
}

/**
 * Construye la línea de código Playwright para un paso.
 *
 * Retorna `null` si el tipo no tiene code-generation (por ejemplo, "generico"
 * o "seleccionar" sin suficiente info).
 */
export function serializarPaso(
  paso: PasoParaSerializar,
  parametros: ParametroParaSerializar[] = [],
  indent: string = "  ",
): string | null {
  const candidates = candidatesFromPaso(paso);
  const best = pickBestSelector(candidates);

  // FIX: si el mejor selector tiene value vacio o solo whitespace, NO
  // emitir codigo Playwright invalido tipo `page.locator(\`\`)` que falla
  // con "expected non-empty character sequence" o timeout. En su lugar
  // emitir un comentario para revision manual. Casos:
  // - Assert creado sin elemento pickeado correctamente
  // - Click sobre un wrapper div sin id/name/text unico
  const bestValid =
    best !== null && typeof best.value === "string" && best.value.trim().length > 0
      ? best
      : null;

  switch (paso.tipo) {
    case "navegar": {
      const url = paso.valor ?? "";
      if (!url) return `${indent}// Paso ${paso.numero}: navegacion sin URL`;
      const ref = findParamRef(url, parametros);
      const final = ref ? inlineParamRef(url) : jsStringEscape(url);
      // waitUntil:'domcontentloaded' matchea lo que usa el recorder-worker
      // y es mas rapido que 'load' (default). Tambien evita que
      // `toHaveCount(1)` falle porque la pagina no haya terminado de cargar
      // — el assert llega justo despues del goto.
      return `${indent}await page.goto(\`${final}\`, { waitUntil: 'domcontentloaded' });`;
    }
    case "clic": {
      if (!bestValid) return `${indent}// Paso ${paso.numero}: clic sin selector valido — revisar manualmente`;
      const method = playwrightMethodFor(bestValid.strategy);
      const arg = playwrightArgFor(bestValid.strategy, bestValid.value);
      const argJs = jsStringEscape(arg);
      const options = bestValid.strategy === "role" ? playwrightRoleOptionsFor(paso, bestValid.value) : "";
      return `${indent}await page.${method}(\`${argJs}\`${options}).click();`;
    }
    case "escribir": {
      if (!bestValid) return `${indent}// Paso ${paso.numero}: escribir sin selector valido — revisar manualmente`;
      // FIX: para passwords (valor=null por seguridad) NO emitimos fill
      // con string vacio. El test puede fallar porque llenar password con
      // "" borra el valor. En su lugar emitimos un comentario y dejamos
      // que el usuario agregue un parametro de credencial via HU-G13
      // (CSV data-driven) o via setup del credential en el caso.
      if (paso.valor === null && paso.esValorSensible) {
        return `${indent}// Paso ${paso.numero}: escribir credencial — agregar parametro o credential setup`;
      }
      const method = playwrightMethodFor(bestValid.strategy);
      const arg = jsStringEscape(playwrightArgFor(bestValid.strategy, bestValid.value));
      const valor = paso.valor ?? "";
      const valorRef = findParamRef(valor, parametros);
      const finalValor = valorRef ? inlineParamRef(valor) : jsStringEscape(valor);
      const options = bestValid.strategy === "role" ? playwrightRoleOptionsFor(paso, bestValid.value) : "";
      return `${indent}await page.${method}(\`${arg}\`${options}).fill(\`${finalValor}\`);`;
    }
    case "esperar": {
      const ms = Number.parseInt(paso.valor ?? "1000", 10);
      const safeMs = Number.isFinite(ms) && ms >= 0 ? ms : 1000;
      return `${indent}await page.waitForTimeout(${safeMs});`;
    }
    case "tecla": {
      // Tecla especial (Enter, ArrowDown, Escape, Tab, F1-F12).
      // Playwright codegen lo emite como `locator.press(KEY)` no
      // `page.keyboard.press(KEY)` — usa el locator del elemento que
      // tenia focus cuando se apretó la tecla.
      const key = paso.valor ?? "";
      if (!key) return `${indent}// Paso ${paso.numero}: tecla sin key`;
      if (!bestValid) {
        return `${indent}await page.keyboard.press(${JSON.stringify(key)});`;
      }
      const method = playwrightMethodFor(bestValid.strategy);
      const arg = jsStringEscape(playwrightArgFor(bestValid.strategy, bestValid.value));
      const options = bestValid.strategy === "role" ? playwrightRoleOptionsFor(paso, bestValid.value) : "";
      return `${indent}await page.${method}(\`${arg}\`${options}).press(${JSON.stringify(key)});`;
    }
    case "verificar": {
      if (!bestValid) return `${indent}// Paso ${paso.numero}: verificacion sin selector valido — revisar manualmente`;
      const method = playwrightMethodFor(bestValid.strategy);
      const arg = jsStringEscape(playwrightArgFor(bestValid.strategy, bestValid.value));
      const options = bestValid.strategy === "role" ? playwrightRoleOptionsFor(paso, bestValid.value) : "";
      const expected = paso.valor ?? "";
      const expectedRef = findParamRef(expected, parametros);
      const finalExpected = expectedRef ? inlineParamRef(expected) : jsStringEscape(expected);

      switch (paso.assertionKind) {
        case "visible":
          return `${indent}await expect(page.${method}(\`${arg}\`${options})).toBeVisible();`;
        case "texto_igual":
          return `${indent}await expect(page.${method}(\`${arg}\`${options})).toHaveText(\`${finalExpected}\`);`;
        case "texto_contiene":
          return `${indent}await expect(page.${method}(\`${arg}\`${options})).toContainText(\`${finalExpected}\`);`;
        case "valor_igual":
          return `${indent}await expect(page.${method}(\`${arg}\`${options})).toHaveValue(\`${finalExpected}\`);`;
        case "count":
          const n = Number.parseInt(expected, 10);
          const nSafe = Number.isFinite(n) && n >= 0 ? n : 1;
          return `${indent}await expect(page.${method}(\`${arg}\`${options})).toHaveCount(${nSafe});`;
        case "snapshot":
          // HU-G6 snapshot: el `valor` ya viene siendo el YAML del aria tree
          // (capturado por el worker en pick_result.ariaSnapshot). Lo
          // emitimos como template literal de TS preservando saltos de linea.
          return `${indent}await expect(page.${method}(\`${arg}\`${options})).toMatchAriaSnapshot(\`${expected}\`);`;
        default:
          // Default to toBeVisible for unknown assertion kinds.
          return `${indent}await expect(page.${method}(\`${arg}\`${options})).toBeVisible();`;
      }
    }
    case "seleccionar":
      if (!bestValid) return `${indent}// Paso ${paso.numero}: select sin selector`;
      const method2 = playwrightMethodFor(bestValid.strategy);
      const arg2 = jsStringEscape(playwrightArgFor(bestValid.strategy, bestValid.value));
      const options2 = bestValid.strategy === "role" ? playwrightRoleOptionsFor(paso, bestValid.value) : "";
      return `${indent}await page.${method2}(\`${arg2}\`${options2}).selectOption(/* value */);`;
    case "generico":
    default:
      return null;
  }
}

/**
 * Función principal: serializa todos los pasos a un source string .spec.ts.
 *
 * Estructura del output:
 *   ```ts
 *   import { test, expect } from '@playwright/test';
 *
 *   test('Consulta de saldo', async ({ page }) => {
 *     const params = { usuario: "admin" };
 *
 *     // Paso 1: Abrir «portal»
 *     await page.goto(`https://portal.example.com/login`);
 *
 *     // Paso 2: Clic en «Ingresar»
 *     await page.getByRole(`button`, { name: `Ingresar` }).click();
 *   });
 *   ```
 */
export function serializarPasos(
  pasos: PasoParaSerializar[],
  options: SerializarPasosOptions,
): string {
  const { nombreDelCaso, parametros = [], indent = "  " } = options;
  const paramsLiteral = buildParamsObject(parametros);

  const lineas: string[] = [];
  lineas.push(`import { test, expect } from '@playwright/test';`);
  lineas.push("");
  lineas.push(
    `test(${JSON.stringify(nombreDelCaso)}, async ({ page }) => {`,
  );
  lineas.push(`${indent}const params = ${paramsLiteral};`);
  lineas.push("");

  for (const paso of pasos) {
    lineas.push(`${indent}// Paso ${paso.numero}: ${paso.descripcion}`);
    const code = serializarPaso(paso, parametros, indent);
    if (code !== null) {
      lineas.push(code);
    } else {
      lineas.push(`${indent}// (paso manual sin code-gen: revisar en UI)`);
    }
  }

  lineas.push("});");
  lineas.push("");

  return lineas.join("\n");
}

export { SerializedElementFull };
