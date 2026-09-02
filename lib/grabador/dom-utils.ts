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
export interface SerializedElementFull {
  /** Nombre del tag lowercased. */
  tag: string;
  /** Rol del elemento (`role` attr o tagName como fallback). */
  role: string;
  /** Texto visible truncado a 50 chars. */
  text: string;
  /** Atributo `data-testid`. */
  testId: string;
  /** `aria-label`, `name`, o `id` (en ese orden). */
  aria: string;
  /** Atributo `name` (input/select/textarea). */
  name: string;
  /** Lista de candidatos de selector priorizados. */
  candidates: Array<{ strategy: string; value: string }>;
  /** Bounding box del elemento relativa al viewport. */
  bbox: { x: number; y: number; width: number; height: number } | null;
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
 * Mapea el role ARIA implicito de un elemento HTML segun su tag + atributos.
 * Esto matchea lo que Playwright codegen hace internamente: para cada
 * elemento determina el role semantico (searchbox, combobox, button,
 * link, etc.) y emite `page.getByRole(role, { name })`.
 *
 * Si el elemento tiene `role` attribute EXPLICITO, gana sobre el implicito.
 */
function implicitRole(el: Element): string | null {
  const tag = el.tagName.toLowerCase();
  // Inputs: el role depende del type
  if (tag === "input") {
    const type = ((el as unknown as { type?: string }).type ?? "text").toLowerCase();
    switch (type) {
      case "search":
        return "searchbox";
      case "checkbox":
        return "checkbox";
      case "radio":
        return "radio";
      case "range":
        return "slider";
      case "email":
      case "tel":
      case "url":
      case "text":
        return "textbox";
      case "submit":
      case "button":
      case "reset":
        return "button";
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
  if (tag === "button") return "button";
  if (tag === "select") return "combobox";
  if (tag === "textarea") return "textbox";
  if (tag === "a") return "link";
  if (tag === "nav") return "navigation";
  if (tag === "main") return "main";
  if (tag === "header") return "banner";
  if (tag === "footer") return "contentinfo";
  if (tag === "aside") return "complementary";
  if (tag === "nav") return "navigation";
  if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
    return "heading";
  }
  if (tag === "ul" || tag === "ol") return "list";
  if (tag === "li") return "listitem";
  if (tag === "img" && el.getAttribute?.("alt")) return "img";
  return null;
}

export function serializeElement(
  el: Element | null | undefined,
): SerializedElementFull | null {
  if (!el || (el as Node).nodeType !== 1) return null;

  const tag = (el.tagName || "").toLowerCase();
  // Role explicito gana sobre implicito. Si no hay explicito, calculamos
  // el implicito segun tag+atributos (input type=search -> searchbox, etc).
  const explicitRole = el.getAttribute?.("role") || "";
  const computedRole = explicitRole || implicitRole(el) || tag;
  const role = computedRole;
  // Normalizar texto para evitar que whitespace del HTML (\n, espacios
  // multiples, etc) se incluya en el selector text. Playwright SI
  // normaliza whitespace internamente pero trailing/leading newlines
  // hacen que el selector text NO matchee elementos como labels que
  // tienen textContent con indentacion por el HTML.
  //   <label>Correo electronico\n                        \n      </label>
  //   -> getByText("Correo electronico") ✓
  //   -> getByText("Correo electronico\n \n      ") ✗ (lo que generabamos)
  const rawText = ((el.textContent || "")).replace(/\s+/g, " ").trim();
  const text = rawText.slice(0, 50);

  // FIX bug: antes se colapsaba aria-label/name/id en un solo campo "aria"
  // y siempre se etiquetaba el candidato como "aria-label". Eso causaba
  // que `getByLabel("username")` se generara para un input que SOLO
  // tenia id="username" (sin aria-label real) y por lo tanto Playwright
  // esperaba 180s sin encontrar el locator.
  const ariaLabelAttr = el.getAttribute?.("aria-label") || "";
  const idAttr = el.id || "";
  const nameAttr = el.getAttribute?.("name") || "";
  const testIdAttr = el.getAttribute?.("data-testid") || "";

  const candidates: Array<{ strategy: string; value: string }> = [];
  if (testIdAttr) {
    candidates.push({
      strategy: "testid",
      value: `[data-testid="${escapeSelectorText(testIdAttr)}"]`,
    });
  }
  // Role (explicito o implicito segun tag/type): esto es lo que Playwright
  // codegen usa — getByRole('combobox', { name }) matchea semanticamente.
  // El rol implicito cubre inputs sin role explicito (search->searchbox,
  // select->combobox, button->button, etc).
  if (role && role !== tag) {
    candidates.push({ strategy: "role", value: role });
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
  if (text && text.length < 30) {
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
