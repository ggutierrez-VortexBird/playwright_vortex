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
  type SelectorCandidate,
} from "@/lib/grabador/dom-utils";

/** Cap absoluto para `waitForTimeout` en el codegen.
 *  Más que esto = Playwright auto-wait ya cubre. Si llega un wait
 *  mayor a este cap, lo SKIPEAMOS entero (no emitimos nada).
 *  Esto matchea lo que hace `playwright codegen` para esperas largas. */
export const MAX_WAIT_PERSIST_MS = 1500;

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
function candidatesFromPaso(paso: PasoParaSerializar): SelectorCandidate[] {
  const respaldo = paso.selectoresRespaldo;
  if (Array.isArray(respaldo)) {
    return respaldo.filter(
      (c): c is SelectorCandidate =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as { strategy?: unknown }).strategy === "string" &&
        typeof (c as { value?: unknown }).value === "string",
    );
  }
  // Fallback: build candidates from selectorPrincipal primitives.
  // (sin `name` — el selectorPrincipal viejo no tenía accessible name).
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
    const candidates: SelectorCandidate[] = [];
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
 * La fuente de verdad del `name` es el `accessibleName` que ya calculó
 * el `serializeElement` (browser-side) y viaja en `candidate.name`.
 * Solo si eso no viene caemos al regex sobre `paso.descripcion` como
 * fallback para pasos viejos (pre-fix de dom-utils).
 *
 * Formatos que matchea el fallback:
 *   "Clic en «NAME»" / "Escribir «x» en «NAME»" / "Tecla en «NAME»"
 */
function playwrightRoleOptionsFor(
  _paso: { tipo: string; valor: string | null; descripcion: string },
  _roleValue: string,
  accessibleNameFromCandidate?: string,
): string {
  if (_paso.tipo === "navegar") return "";
  // FIX ronda 5: SOLO usar el name que viene del candidate (browser-side).
  // NO usar `descripcion` como fallback para el accessible name de getByRole.
  // La descripcion es para humanos y puede contener el atributo HTML `name`
  // (ej. "login-button") que NO es el accessible name real (ej. "Login").
  // Usar la descripcion genera getByRole('button', { name: 'login-button' })
  // que NUNCA matchea → timeout de 60s.
  let name = (accessibleNameFromCandidate ?? "").trim();
  if (!isUsefulRoleName(name)) return "";
  return `, { name: \`${jsStringEscape(name.slice(0, 50))}\` }`;
}

/**
 * ¿Es un `accessibleName` útil para `getByRole(role, { name })`?
 *
 * Playwright codegen rechaza names que:
 *   - Sean solo caracteres Private Use (\p{Co}) — icon fonts
 *   - Sean muy cortos (< 2 chars) — matchean demasiados elementos
 *   - Sean whitespace-only
 *
 * Referencia: packages/injected/src/selectorGenerator.ts en Playwright:
 *   `if (ariaName && !ariaName.match(/^\p{Co}+$/u)) { ... }`
 */
function isUsefulRoleName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  // Rechazar si es SOLO caracteres Private Use (icon fonts)
  if (/^\p{Co}+$/u.test(trimmed)) return false;
  // Rechazar si parece un atributo HTML `name` (kebab-case identifier).
  // Ej: "login-button", "user-name" — son IDs programáticos, NO accessible names.
  // Los accessible names reales son texto humano: "Login", "Buscar en Wikipedia".
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(trimmed)) return false;
  return true;
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
  // `pickBestSelector` retorna `{ strategy, value }` pero los candidates
  // pueden traer `name` (cuando strategy='role'). Cast para acceder al
  // `name` en los cases que lo necesitan. El cast es seguro porque los
  // candidates vienen de `candidatesFromPaso` que devuelve `SelectorCandidate[]`.
  const best = pickBestSelector(candidates) as (SelectorCandidate & {
    strategy: string;
    value: string;
  }) | null;

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

  /**
   * Resuelve el candidate efectivo aplicando fallbacks de seguridad.
   *   1. Si es 'text' con texto sospechoso → cae al siguiente candidate.
   *   2. Si es 'role' sin name útil → cae al siguiente candidate.
   *      El "name útil" incluye fallbacks de descripcion/valor, no solo
   *      candidate.name directo. (Playwright codegen hace esto:
   *      `kRoleWithoutNameScore = 510` es casi tan malo como CSS fallback).
   */
  function resolveEffectiveBest(
    initial: typeof bestValid,
    allCandidates: SelectorCandidate[],
    pasoRef: { tipo: string; valor: string | null; descripcion: string },
  ): typeof bestValid {
    if (!initial) return null;
    let effective = initial;
    if (effective.strategy === "text" && !isUsableTextSelectorValue(effective.value)) {
      const fallback = allCandidates.find(
        (c) => c.strategy !== "text" && c.value && c.value.trim().length > 0,
      );
      if (fallback) effective = fallback as typeof effective;
    }
    if (effective.strategy === "role") {
      // FIX ronda 5: solo considerar candidate.name directo. NO usar
      // descripcion/valor como fallback porque pueden contener atributos
      // HTML (ej. name="login-button") que NO son el accessible name real.
      const effectiveName = (effective.name ?? "").trim();
      if (!isUsefulRoleName(effectiveName)) {
        const fallback = allCandidates.find(
          (c) => c.strategy !== "role" && c.value && c.value.trim().length > 0,
        );
        if (fallback) effective = fallback as typeof effective;
      }
    }
    return effective;
  }

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
      const effectiveBest = resolveEffectiveBest(bestValid, candidates, paso);
      if (!effectiveBest) return `${indent}// Paso ${paso.numero}: clic sin selector unico — revisar manualmente`;
      const method = playwrightMethodFor(effectiveBest.strategy);
      const arg = playwrightArgFor(effectiveBest.strategy, effectiveBest.value);
      const argJs = jsStringEscape(arg);
      const options =
        effectiveBest.strategy === "role"
          ? playwrightRoleOptionsFor(paso, effectiveBest.value, effectiveBest.name)
          : "";
      // NOTA: NO agregamos .first() en acciones (clic/fill/press).
      // Si hay multiples matches, es mejor que falle rapido con strict mode
      // violation a que se cuelgue 3 minutos esperando un elemento invisible.
      // Playwright strict mode es una feature, no un bug, para acciones.
      return `${indent}await page.${method}(\`${argJs}\`${options}).click();`;
    }
    case "escribir": {
      if (!bestValid) return `${indent}// Paso ${paso.numero}: escribir sin selector valido — revisar manualmente`;
      const effectiveBest = resolveEffectiveBest(bestValid, candidates, paso);
      if (!effectiveBest) return `${indent}// Paso ${paso.numero}: escribir sin selector unico — revisar manualmente`;
      // FIX CRITICO: para passwords (valor=null por seguridad) emitimos un
      // fill REAL contra `params.password`, no un comentario. Antes el codegen
      // emitía solo `// Paso N: escribir credencial — agregar parametro` y el
      // test fallaba en login porque el input quedaba vacío. Ahora: el test
      // se autogenera con `params.password = ""` en el objeto params, y el
      // usuario edita el valor (o usa env var / CSV data-driven) ANTES de
      // correr. El nombre del param (`password`) puede sobreescribirse via
      // `descripcion` matcheando `{{nombre}}` luego.
      if (paso.valor === null && paso.esValorSensible) {
        const method = playwrightMethodFor(effectiveBest.strategy);
        const arg = jsStringEscape(playwrightArgFor(effectiveBest.strategy, effectiveBest.value));
        const options =
          effectiveBest.strategy === "role"
            ? playwrightRoleOptionsFor(paso, effectiveBest.value, effectiveBest.name)
            : "";
        return `${indent}await page.${method}(\`${arg}\`${options}).first().fill(params.password);`;
      }
      const method = playwrightMethodFor(effectiveBest.strategy);
      const arg = jsStringEscape(playwrightArgFor(effectiveBest.strategy, effectiveBest.value));
      const valor = paso.valor ?? "";
      const valorRef = findParamRef(valor, parametros);
      const finalValor = valorRef ? inlineParamRef(valor) : jsStringEscape(valor);
      const options =
        effectiveBest.strategy === "role"
          ? playwrightRoleOptionsFor(paso, effectiveBest.value, effectiveBest.name)
          : "";
      return `${indent}await page.${method}(\`${arg}\`${options}).first().fill(\`${finalValor}\`);`;
    }
    case "esperar": {
      const ms = Number.parseInt(paso.valor ?? "1000", 10);
      const safeMs = Number.isFinite(ms) && ms >= 0 ? ms : 1000;
      // FIX: cap absoluto en MAX_WAIT_PERSIST_MS. Playwright ya tiene
      // auto-wait built-in para todo lo >1.5s, asi que waits grandes en
      // el codegen SON RUIDO (reducen velocidad, no aportan robustez).
      // Si llega un wait mayor, SKIPPEAMOS el paso entero (comentario
      // explicativo para que se vea en el .spec.ts que el wait existia).
      if (safeMs > MAX_WAIT_PERSIST_MS) {
        return `${indent}// Paso ${paso.numero}: esperar ${safeMs}ms omitido (>${MAX_WAIT_PERSIST_MS}ms — Playwright auto-wait cubre)`;
      }
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
      const effectiveBest = resolveEffectiveBest(bestValid, candidates, paso);
      if (!effectiveBest) {
        return `${indent}await page.keyboard.press(${JSON.stringify(key)});`;
      }
      const method = playwrightMethodFor(effectiveBest.strategy);
      const arg = jsStringEscape(playwrightArgFor(effectiveBest.strategy, effectiveBest.value));
      const options =
        effectiveBest.strategy === "role"
          ? playwrightRoleOptionsFor(paso, effectiveBest.value, effectiveBest.name)
          : "";
      return `${indent}await page.${method}(\`${arg}\`${options}).first().press(${JSON.stringify(key)});`;
    }
    case "verificar": {
      if (!bestValid) return `${indent}// Paso ${paso.numero}: verificacion sin selector valido — revisar manualmente`;
      const effectiveBest = resolveEffectiveBest(bestValid, candidates, paso);
      if (!effectiveBest) return `${indent}// Paso ${paso.numero}: verificacion sin selector unico — revisar manualmente`;
      const method = playwrightMethodFor(effectiveBest.strategy);
      const arg = jsStringEscape(playwrightArgFor(effectiveBest.strategy, effectiveBest.value));
      const options =
        effectiveBest.strategy === "role"
          ? playwrightRoleOptionsFor(paso, effectiveBest.value, effectiveBest.name)
          : "";
      const expected = paso.valor ?? "";
      const expectedRef = findParamRef(expected, parametros);
      const finalExpected = expectedRef ? inlineParamRef(expected) : jsStringEscape(expected);

      switch (paso.assertionKind) {
        case "visible":
          return `${indent}await expect(page.${method}(\`${arg}\`${options}).first()).toBeVisible();`;
        case "texto_igual":
          return `${indent}await expect(page.${method}(\`${arg}\`${options}).first()).toHaveText(\`${finalExpected}\`);`;
        case "texto_contiene":
          return `${indent}await expect(page.${method}(\`${arg}\`${options}).first()).toContainText(\`${finalExpected}\`);`;
        case "valor_igual":
          return `${indent}await expect(page.${method}(\`${arg}\`${options}).first()).toHaveValue(\`${finalExpected}\`);`;
        case "count":
          const n = Number.parseInt(expected, 10);
          const nSafe = Number.isFinite(n) && n >= 0 ? n : 1;
          return `${indent}await expect(page.${method}(\`${arg}\`${options}).first()).toHaveCount(${nSafe});`;
        case "snapshot":
          // HU-G6 snapshot: el `valor` ya viene siendo el YAML del aria tree
          // (capturado por el worker en pick_result.ariaSnapshot). Lo
          // emitimos como template literal de TS preservando saltos de linea.
          return `${indent}await expect(page.${method}(\`${arg}\`${options}).first()).toMatchAriaSnapshot(\`${expected}\`);`;
        default:
          // Default to toBeVisible for unknown assertion kinds.
          return `${indent}await expect(page.${method}(\`${arg}\`${options}).first()).toBeVisible();`;
      }
    }
    case "seleccionar":
      if (!bestValid) return `${indent}// Paso ${paso.numero}: select sin selector`;
      const method2 = playwrightMethodFor(bestValid.strategy);
      const arg2 = jsStringEscape(playwrightArgFor(bestValid.strategy, bestValid.value));
      const options2 =
        bestValid.strategy === "role"
          ? playwrightRoleOptionsFor(paso, bestValid.value, bestValid.name)
          : "";
      return `${indent}await page.${method2}(\`${arg2}\`${options2}).selectOption(/* value */);`;
    case "generico":
    default:
      return null;
  }
}

/** Versión inline de `isUsableTextSelector` (lib/grabador/dom-utils.ts).
 *  Recheaza textos:
 *    - vacíos
 *    - >=30 chars (típico `textContent` con hijos concatenados)
 *    - con patron "PerúJulián" (lowercase pegado a uppercase) — concat
 *      inequívoca de nodos hermanos.
 *  Esto evita que el codegen emita `getByText` que NO matchea el locator. */
function isUsableTextSelectorValue(text: string): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length < 3) return false;
  if (t.length >= 30) return false;
  if (/[\p{Ll}][\p{Lu}]/u.test(t)) return false;
  return true;
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
  const { nombreDelCaso, parametros: userParams = [], indent = "  " } = options;

  // FIX CREDENCIALES: detectar si hay pasos sensibles (password). Si los hay,
  // auto-agregar `password: ""` al objeto params para que el `fill(params.password)`
  // emitido por serializarPaso() tenga algo que resolver en runtime.
  // Antes el params = {} y el codegen emitía solo un comment → login fallaba
  // con "Username and password do not match" porque el input quedaba vacío.
  const hasPasswordStep = pasos.some(
    (p) => p.tipo === "escribir" && p.esValorSensible && p.valor === null,
  );
  const parametros = [...userParams];
  if (hasPasswordStep && !parametros.some((p) => p.nombre === "password")) {
    parametros.push({ nombre: "password", valorDefecto: "" });
  }

  const paramsLiteral = buildParamsObject(parametros);

  const lineas: string[] = [];
  let emittedAnyExpect = false; // FIX ronda 4: track si emitimos al menos 1 expect()
  let lastFillKey = ""; // FIX ronda 4: dedupe de fills consecutivos idénticos

  lineas.push(`import { test, expect } from '@playwright/test';`);
  lineas.push("");
  lineas.push(
    `test(${JSON.stringify(nombreDelCaso)}, async ({ page }) => {`,
  );
  // Si auto-agregamos password, dejamos un comentario TODO explicativo arriba
  // del objeto params para que el usuario edite el valor antes de correr.
  if (hasPasswordStep && !userParams.some((p) => p.nombre === "password")) {
    lineas.push(`${indent}// TODO: reemplazar el valor de \`password\` antes de ejecutar (o leerlo de process.env.PASSWORD).`);
  }
  lineas.push(`${indent}const params = ${paramsLiteral};`);
  lineas.push("");

  for (const paso of pasos) {
    const code = serializarPaso(paso, parametros, indent);
    if (code === null) {
      // FIX ronda 4: NO emitir comentarios "paso manual sin code-gen" para
      // pasos 'generico' (keydowns no-especiales, etc). Antes generaban 13+
      // líneas de ruido en tests típicos. El codegen ahora los SKIP silencioso.
      // Si en el futuro se necesita depurar, agregar `if (paso.tipo !== 'generico')`.
      continue;
    }

    // FIX ronda 4: dedupe de fills consecutivos idénticos. El grabador
    // actualmente genera 2+ fills para el mismo campo (1º input event sin
    // `name` capturado, 2º con todo, etc.). Si el (selector, valor) es
    // exactamente el mismo que el ÚLTIMO fill que emitimos (no importa qué
    // haya entremedio — waits, keydowns, clicks a otros campos cuentan como
    // "entremedio"), NO emitimos el duplicado.
    if (
      paso.tipo === "escribir" &&
      code.includes(".fill(")
    ) {
      // Captura strategy + selector + fill_arg. El fill_arg puede ser:
      //   - backtick-delimited:  `value`
      //   - template interp:     ${params.password} (sin backticks)
      //   - string literal:      "value"
      const fillKey = code.match(/page\.(\w+)\(([\s\S]+?)\)\.first\(\)\.fill\(([\s\S]+?)\);/);
      const key = fillKey ? `${fillKey[1]}|${fillKey[2]}|${fillKey[3]}` : "";
      if (key && key === lastFillKey) {
        continue;
      }
      lastFillKey = key;
    }

    lineas.push(`${indent}// Paso ${paso.numero}: ${paso.descripcion}`);
    lineas.push(code);
    if (code.includes("expect(")) emittedAnyExpect = true;
  }

  // FIX ronda 4: fallback assertion. Si el test no emitió NINGÚN expect()
  // (típico: usuario grabó un flujo pero nunca agregó un verify), emitimos
  // uno al final que valide que la página cargó algo. ANTES el test "pasaba"
  // vacíamente sin校验 nada — Playwright lo daba por bueno.
  if (!emittedAnyExpect) {
    lineas.push("");
    lineas.push(`${indent}// FIX: fallback assertion para que el test no pase vacíamente.`);
    lineas.push(`${indent}// Reemplazar por una verificación específica del flujo.`);
    lineas.push(`${indent}await expect(page.locator("body").first()).toBeVisible();`);
  }

  lineas.push("});");
  lineas.push("");

  return lineas.join("\n");
}

export { SerializedElementFull };
