/**
 * dom-utils — serialización de elementos DOM compartidos entre
 * el browser-side init-script y el Node-side recorder-worker.
 *
 * HU-G5: el cliente puede pedir `elementFromPoint(x, y)` desde Node vía
 * `page.evaluate(...)`. Para que el payload resultante sea consistente con
 * lo que ya emite el init-script (SerializadoElemento en translator.ts),
 * exponemos la misma forma `serializeElement` acá en TypeScript.
 *
 * NOTA: este módulo NO se ejecuta en el browser (no se inyecta vía
 * addInitScript). Solo se usa desde Node para serializar elementos que
 * vienen como respuesta de `page.evaluate(({x,y}) => elementFromPoint(...))`.
 * El init-script sigue conteniendo su propio `serializeElement` en JS plano
 * (mantenerlo así evita una dependencia cruzada browser↔Node).
 *
 * La forma retornada es compatible con `SerializedElement` en
 * `lib/grabador/translator.ts` y con `SerializedElement` en init-script.
 */
/**
 * Candidato de selector. `name` solo se usa cuando `strategy === "role"`:
 * lleva el *accessible name* del elemento para que el codegen pueda emitir
 * `getByRole('searchbox', { name: 'Buscar en Wikipedia' })` — que es
 * exactamente lo que produce `playwright codegen`.
 */
export interface SelectorCandidate {
  strategy: string;
  value: string;
  /** Accessible name — solo para strategy='role'. */
  name?: string;
}

export interface SerializedElementFull {
  /** Nombre del tag lowercased. */
  tag: string;
  /** Rol del elemento (`role` attr, rol ARIA implícito, o tagName). */
  role: string;
  /** Texto visible truncado a 50 chars. */
  text: string;
  /** Atributo `data-testid`. */
  testId: string;
  /** `aria-label`, `name`, o `id` (en ese orden). */
  aria: string;
  /** Atributo `name` (input/select/textarea). */
  name: string;
  /** Accessible name computado (aria-label > label > placeholder > texto). */
  accessibleName: string;
  /** Lista de candidatos de selector priorizados. */
  candidates: SelectorCandidate[];
  /** Bounding box del elemento relativa al viewport. */
  bbox: { x: number; y: number; width: number; height: number } | null;
}

/** Longitud mínima de un texto para servir como selector (`>2 chars`). */
export const TEXT_SELECTOR_MIN_LEN = 3;
/** Longitud máxima (exclusiva). Textos más largos son casi siempre
 *  `textContent` de un contenedor con los hijos pegados. */
export const TEXT_SELECTOR_MAX_LEN = 30;

/**
 * Normaliza un texto capturado del DOM para usarlo como selector.
 *
 * Hace, en orden:
 *   1. Normalización Unicode NFC (los acentos compuestos de Wikipedia
 *      llegan a veces como `a` + combining accent).
 *   2. Reemplaza NBSP / narrow-NBSP por espacio normal.
 *   3. Elimina zero-width, BOM y separadores de línea Unicode.
 *   4. Reemplaza caracteres de control por espacio.
 *   5. Colapsa runs de whitespace a UN espacio y trimea.
 *
 * Debe mantenerse en sync con `normalizeText()` del init-script del browser.
 */
export function normalizeSelectorText(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  let s = raw;
  try {
    s = s.normalize("NFC");
  } catch {
    // Entornos sin ICU completo — seguimos con el string original.
  }
  s = s.replace(/[\u00a0\u1680\u2000-\u200a\u2007\u202f\u205f\u3000]/g, " ");
  s = s.replace(/[\u200b-\u200f\u2028\u2029\u2060\ufeff]/g, "");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001f\u007f]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * ¿Sirve este texto como selector `getByText`?
 *
 * Rechaza:
 *   - <3 chars (ruido: "x", "•", "1")
 *   - >=30 chars (es `textContent` de un contenedor, con los hijos pegados:
 *     "Juliciudad en Puno, PerúJulián Alvarezfutbolista a…")
 *   - patrones "pegados" tipo `PerúJulián` (minúscula seguida de mayúscula
 *     sin espacio) — señal inequívoca de concatenación de nodos hermanos.
 */
export function isUsableTextSelector(text: string | null | undefined): boolean {
  const t = normalizeSelectorText(text);
  if (t.length < TEXT_SELECTOR_MIN_LEN) return false;
  if (t.length >= TEXT_SELECTOR_MAX_LEN) return false;
  if (/[\p{Ll}][\p{Lu}]/u.test(t)) return false;
  return true;
}

/**
 * Versión "lite" de un elemento serializado — la que se persiste en
 * `PasoGrabado.selectorPrincipal`. Expuesta como tipo aparte para que los
 * tests puedan verificar shapes sin ambigüedad.
 */
export interface SerializedElementLite {
  tag: string | null;
  text: string | null;
  aria: string | null;
  testId: string | null;
}

/**
 * Normaliza un texto para uso como selector (recorta, escapa comillas dobles).
 * Mantiene el mismo contrato que el init-script del browser.
 */
function escapeSelectorText(text: string): string {
  return text.replace(/"/g, '\\"');
}

/**
 * Genera un selector CSS tipo "html > body > div#foo > button" — fallback
 * cuando no hay testId / aria / id / name. Implementa el mismo algoritmo
 * que la versión browser-side (path relativo con nth-of-type).
 */
export function buildCssPath(el: Element): string {
  if (!el || typeof el.nodeName !== "string") return "";
  const segments: string[] = [];
  let current: Element | null = el;
  while (current && current.nodeType === 1) {
    let seg = current.nodeName.toLowerCase();
    if (current.id) {
      seg += `#${current.id}`;
      segments.unshift(seg);
      break;
    }
    let sib: Element | null = current;
    let nth = 1;
    while ((sib = sib.previousElementSibling) != null) {
      if (sib.nodeName.toLowerCase() === seg) nth++;
    }
    if (nth !== 1) seg += `:nth-of-type(${nth})`;
    segments.unshift(seg);
    current = current.parentElement;
  }
  return segments.join(" > ");
}

/**
 * Determina si un elemento es un input de password. Útil para el flag
 * `esValorSensible` desde el lado de Node (defense in depth: aunque el
 * browser init-script ya enmascara, acá verificamos).
 */
export function isPasswordField(el: Element | null): boolean {
  if (!el) return false;
  const t = (el as unknown as { type?: string }).type;
  return typeof t === "string" && t.toLowerCase() === "password";
}

/**
 * Serializa un elemento DOM a la misma forma que el init-script emite.
 *
 * Función pura — no muta el DOM. Si el input no es un Element válido,
 * retorna null (el caller debe manejar el fallback).
 *
 * @param el - elemento a serializar
 * @returns objeto SerializedElementFull o null si no es un Element válido
 */
/**
 * Mapea el role ARIA implícito de un elemento HTML según su tag + `type`.
 *
 * Versión PURA basada en strings — no necesita un `Element`, así que se
 * puede reusar desde `paso-repo` (defense in depth cuando el init-script
 * del browser es viejo y no manda `role`).
 *
 * Esto matchea lo que `playwright codegen` hace internamente: para cada
 * elemento determina el role semántico (searchbox, combobox, button, link…)
 * y emite `page.getByRole(role, { name })`.
 */
export function implicitRoleFor(
  tag: string | null | undefined,
  inputType?: string | null,
): string | null {
  const t = (tag ?? "").toLowerCase();
  if (t === "input") {
    const type = (inputType ?? "text").toLowerCase();
    switch (type) {
      case "search":
        return "searchbox";
      case "checkbox":
        return "checkbox";
      case "radio":
        return "radio";
      case "range":
        return "slider";
      case "number":
        return "spinbutton";
      case "email":
      case "tel":
      case "url":
      case "text":
        return "textbox";
      case "submit":
      case "button":
      case "reset":
      case "image":
        return "button";
      case "password":
      case "file":
      case "hidden":
        return null;
      default:
        return "textbox";
    }
  }
  if (t === "button") return "button";
  if (t === "select") return "combobox";
  if (t === "textarea") return "textbox";
  if (t === "a") return "link";
  if (t === "nav") return "navigation";
  if (t === "main") return "main";
  if (t === "header") return "banner";
  if (t === "footer") return "contentinfo";
  if (t === "aside") return "complementary";
  if (t === "form") return "form";
  if (t === "table") return "table";
  if (t === "option") return "option";
  if (t === "h1" || t === "h2" || t === "h3" || t === "h4" || t === "h5" || t === "h6") {
    return "heading";
  }
  if (t === "ul" || t === "ol") return "list";
  if (t === "li") return "listitem";
  return null;
}

/**
 * Resuelve el role efectivo: el atributo `role` explícito gana; si no hay,
 * usamos el implícito del tag; si tampoco, `null`.
 *
 * `null` significa "este elemento no tiene role accesible" → el codegen
 * debe caer a otra estrategia (id / aria-label / text / css).
 */
export function resolveRole(
  tag: string | null | undefined,
  explicitRole?: string | null,
  inputType?: string | null,
): string | null {
  const explicit = normalizeSelectorText(explicitRole);
  if (explicit) return explicit;
  return implicitRoleFor(tag, inputType);
}

/**
 * Calcula el *accessible name* de un elemento, aproximando el algoritmo de
 * accname que usa Playwright para `getByRole(role, { name })`:
 *
 *   aria-label > aria-labelledby > <label for> / <label> ancestro >
 *   placeholder > title > alt > textContent (solo si no es form control)
 *
 * Devuelve "" cuando no hay nombre accesible utilizable.
 */
export function accessibleNameFor(el: Element | null | undefined): string {
  if (!el) return "";
  const attr = (n: string): string =>
    typeof el.getAttribute === "function" ? normalizeSelectorText(el.getAttribute(n)) : "";

  const ariaLabel = attr("aria-label");
  if (ariaLabel) return ariaLabel;

  const doc = (el as unknown as { ownerDocument?: Document | null }).ownerDocument ?? null;

  const labelledBy = attr("aria-labelledby");
  if (labelledBy && doc && typeof doc.getElementById === "function") {
    const joined = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent ?? "")
      .join(" ");
    const name = normalizeSelectorText(joined);
    if (name) return name;
  }

  const id = el.id || "";
  if (id && doc && typeof doc.querySelector === "function") {
    try {
      const lbl = doc.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`);
      const name = normalizeSelectorText(lbl?.textContent ?? "");
      if (name) return name;
    } catch {
      // selector inválido (id con caracteres raros) — seguimos.
    }
  }

  if (typeof (el as unknown as { closest?: unknown }).closest === "function") {
    try {
      const wrapping = el.closest("label");
      if (wrapping && wrapping !== el) {
        const name = normalizeSelectorText(wrapping.textContent ?? "");
        if (name) return name;
      }
    } catch {
      // ignore
    }
  }

  for (const a of ["placeholder", "title", "alt"]) {
    const v = attr(a);
    if (v) return v;
  }

  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") {
    return "";
  }
  const text = normalizeSelectorText(el.textContent ?? "");
  return text.length > 0 && text.length < 80 ? text : "";
}

export function serializeElement(
  el: Element | null | undefined,
): SerializedElementFull | null {
  if (!el || (el as Node).nodeType !== 1) return null;

  const tag = (el.tagName || "").toLowerCase();
  const inputType = (el as unknown as { type?: string }).type ?? null;
  // Role explicito gana sobre implicito. Si no hay ninguno, `role` cae al
  // tag por compatibilidad del campo, pero NO se emite candidato 'role'.
  const explicitRole = el.getAttribute?.("role") || "";
  const semanticRole = resolveRole(tag, explicitRole, inputType);
  const role = semanticRole ?? tag;
  const accessibleName = accessibleNameFor(el);
  // Normalizar texto (whitespace, NBSP, zero-width, NFC). Sin esto el
  // codegen emite selectores con el indentado del HTML que no matchean:
  //   <label>Correo electronico\n      \n  </label>
  //   -> getByText("Correo electronico") ✓
  //   -> getByText("Correo electronico\n \n ") ✗
  const rawText = normalizeSelectorText(el.textContent);
  const text = rawText.slice(0, 50);

  // FIX bug: antes se colapsaba aria-label/name/id en un solo campo "aria"
  // y siempre se etiquetaba el candidato como "aria-label". Eso causaba
  // que `getByLabel("username")` se generara para un input que SOLO
  // tenia id="username" (sin aria-label real) y por lo tanto Playwright
  // esperaba 180s sin encontrar el locator.
  const ariaLabelAttr = normalizeSelectorText(el.getAttribute?.("aria-label"));
  const idAttr = el.id || "";
  const nameAttr = el.getAttribute?.("name") || "";
  const testIdAttr = el.getAttribute?.("data-testid") || "";

  const candidates: SelectorCandidate[] = [];
  if (testIdAttr) {
    candidates.push({
      strategy: "testid",
      value: `[data-testid="${escapeSelectorText(testIdAttr)}"]`,
    });
  }
  // HU-G14 / FIX bug 3: `role` va SEGUNDO en la prioridad porque es lo que
  // emite `playwright codegen`. Se emite siempre que exista un role
  // semantico (explicito o implicito), incluso si coincide con el tag
  // (`<button>` -> role 'button'): antes el guard `role !== tag` lo
  // descartaba y el codegen caia a getByLabel/getByText.
  if (semanticRole) {
    candidates.push({
      strategy: "role",
      value: semanticRole,
      ...(accessibleName ? { name: accessibleName } : {}),
    });
  }
  if (idAttr) {
    candidates.push({ strategy: "id", value: `#${idAttr}` });
  }
  if (ariaLabelAttr) {
    candidates.push({
      strategy: "aria-label",
      value: `[aria-label="${escapeSelectorText(ariaLabelAttr)}"]`,
    });
  }
  if (nameAttr) {
    candidates.push({
      strategy: "name",
      value: `[name="${escapeSelectorText(nameAttr)}"]`,
    });
  }
  if (isUsableTextSelector(text)) {
    candidates.push({ strategy: "text", value: text });
  }
  if (typeof el.getAttribute === "function") {
    const css = buildCssPath(el);
    if (css) candidates.push({ strategy: "css", value: css });
  }

  let bbox: SerializedElementFull["bbox"] = null;
  if (typeof el.getBoundingClientRect === "function") {
    try {
      const r = el.getBoundingClientRect();
      bbox = { x: r.x, y: r.y, width: r.width, height: r.height };
    } catch {
      bbox = null;
    }
  }

  return {
    tag,
    role,
    text,
    testId: testIdAttr,
    // Mantener compat: `aria` queda como el aria-label real (o "" si
    // no tiene). Antes era el fallback name/id — eso era el bug.
    aria: ariaLabelAttr,
    name: nameAttr,
    accessibleName,
    candidates,
    bbox,
  };
}

/**
 * Versión "lite" para persistir en `selectorPrincipal`. Solo los campos
 * más útiles para identificación humana (tag, text, aria, testId).
 *
 * Mantiene nulls en lugar de strings vacíos para que el JSON sea denso y
 * los queries de debugging distingan "ausente" de "vacío".
 */
export function serializeElementLite(
  el: Element | null | undefined,
): SerializedElementLite | null {
  if (!el || (el as Node).nodeType !== 1) return null;
  // FIX: colapsar whitespace como en serializeElement (full). Si no,
  // el selectorPrincipal queda con \n \n que el codegen emite literal.
  const normalizedText = ((el.textContent || "")).replace(/\s+/g, " ").trim();
  return {
    tag: ((el.tagName || "").toLowerCase()) || null,
    text: (normalizedText.slice(0, 50)) || null,
    aria: el.getAttribute?.("aria-label") || null,
    testId: el.getAttribute?.("data-testid") || null,
  };
}

/**
 * Convierte un elemento serializado a su `selectorPrincipal` JSON para
 * PasoGrabado — la misma forma que `paso-repo.mapearEventoAPaso` usa.
 */
export function toSelectorPrincipal(
  el: SerializedElementFull | null,
): SerializedElementLite | null {
  if (!el) return null;
  return {
    tag: el.tag || null,
    text: el.text || null,
    aria: el.aria || null,
    testId: el.testId || null,
  };
}

/**
 * HU-G14: devuelve el mejor selector disponible siguiendo la prioridad:
 *   testid > role > id > aria-label > name > text > css.
 *
 * "testid" gana porque es el contrato de testing más estable.
 * "role" es el segundo más estable cuando el dev puso un role semántico.
 * "id" es estable mientras nadie lo renombre; los demás son frágiles.
 *
 * Usado por el codegen (HU-G11) para emitir el `page.<strategy>(...)` call.
 */
export function pickBestSelector(
  candidates: Array<{ strategy: string; value: string }>,
): { strategy: string; value: string } | null {
  const priority = ["testid", "role", "id", "aria-label", "name", "text", "css"];
  for (const strat of priority) {
    const found = candidates.find((c) => c.strategy === strat);
    if (found) return found;
  }
  return null;
}
