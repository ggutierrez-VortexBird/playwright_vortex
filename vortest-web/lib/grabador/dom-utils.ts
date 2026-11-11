/** Serialización de elementos DOM en Node (no se inyecta en el browser); misma forma que emite el init-script. */
/** Candidato de selector; `name` solo se usa con strategy "role" (accessible name para `getByRole`). */
export interface SelectorCandidate {
  strategy: string;
  value: string;
  /** Accessible name; solo para strategy='role'. */
  name?: string;
}

export interface SerializedElementFull {
  /** Nombre del tag en minúsculas. */
  tag: string;
  /** Rol del elemento (atributo `role`, rol ARIA implícito o tagName). */
  role: string;
  /** Texto visible truncado a 50 chars. */
  text: string;
  /** Atributo `data-testid`. */
  testId: string;
  /** `aria-label`, `name` o `id` (en ese orden). */
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
/** Longitud máxima (exclusiva); los textos más largos suelen ser el `textContent` de un contenedor. */
export const TEXT_SELECTOR_MAX_LEN = 30;

/** Normaliza un texto del DOM para usarlo como selector (NFC, NBSP, zero-width, control, colapsa whitespace); en sync con `normalizeText()` del init-script. */
export function normalizeSelectorText(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  let s = raw;
  try {
    s = s.normalize("NFC");
  } catch {
    // Entornos sin ICU completo: se sigue con el string original
  }
  s = s.replace(/[\u00a0\u1680\u2000-\u200a\u2007\u202f\u205f\u3000]/g, " ");
  s = s.replace(/[\u200b-\u200f\u2028\u2029\u2060\ufeff]/g, "");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u001f\u007f]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** ¿Sirve el texto como selector `getByText`? Rechaza <3 chars, >=30 chars y textos pegados tipo `PerúJulián`. */
export function isUsableTextSelector(text: string | null | undefined): boolean {
  const t = normalizeSelectorText(text);
  if (t.length < TEXT_SELECTOR_MIN_LEN) return false;
  if (t.length >= TEXT_SELECTOR_MAX_LEN) return false;
  if (/[\p{Ll}][\p{Lu}]/u.test(t)) return false;
  return true;
}

/** Versión "lite" de un elemento serializado, la que se persiste en `PasoGrabado.selectorPrincipal`. */
export interface SerializedElementLite {
  tag: string | null;
  text: string | null;
  aria: string | null;
  testId: string | null;
}

/** Normaliza un texto como selector (recorta, escapa comillas dobles); mismo contrato que el init-script. */
function escapeSelectorText(text: string): string {
  return text.replace(/"/g, '\\"');
}

/** Genera un selector CSS de ruta ("html > body > div#foo > button") como último recurso, con nth-of-type. */
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

/** Indica si un elemento es un input de password (defensa extra para `esValorSensible`). */
export function isPasswordField(el: Element | null): boolean {
  if (!el) return false;
  const t = (el as unknown as { type?: string }).type;
  return typeof t === "string" && t.toLowerCase() === "password";
}

/** Serializa un elemento DOM a la forma del init-script; función pura, devuelve null si no es un Element válido. */
/** Role ARIA implícito de un elemento HTML según tag + `type`; versión pura basada en strings. */
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

/** Role efectivo: el atributo `role` explícito gana, luego el implícito del tag, si no `null`. */
export function resolveRole(
  tag: string | null | undefined,
  explicitRole?: string | null,
  inputType?: string | null,
): string | null {
  const explicit = normalizeSelectorText(explicitRole);
  if (explicit) return explicit;
  return implicitRoleFor(tag, inputType);
}

/** Calcula el *accessible name* aproximando accname (aria-label > aria-labelledby > label > placeholder > title > alt > textContent); "" si no hay. */
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
      // selector inválido (id con caracteres raros): se sigue
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
      // ignorar
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
  // El role explícito gana sobre el implícito; sin ninguno, `role` cae al tag pero no se emite candidato 'role'
  const explicitRole = el.getAttribute?.("role") || "";
  const semanticRole = resolveRole(tag, explicitRole, inputType);
  const role = semanticRole ?? tag;
  const accessibleName = accessibleNameFor(el);
  // Normaliza el texto (whitespace, NBSP, zero-width, NFC) para que getByText no lleve el indentado del HTML
  const rawText = normalizeSelectorText(el.textContent);
  const text = rawText.slice(0, 50);

  // Se separan aria-label, name e id para no etiquetar como "aria-label" un input que solo tiene id
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
  // `role` va segundo en la prioridad (es lo que emite codegen); se emite siempre que exista un role, aunque coincida con el tag.
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
    // `aria` queda como el aria-label real (o "" si no tiene)
    aria: ariaLabelAttr,
    name: nameAttr,
    accessibleName,
    candidates,
    bbox,
  };
}

/** Versión "lite" para `selectorPrincipal` (tag, text, aria, testId); usa null en vez de strings vacíos. */
export function serializeElementLite(
  el: Element | null | undefined,
): SerializedElementLite | null {
  if (!el || (el as Node).nodeType !== 1) return null;
  // Colapsa el whitespace como en serializeElement para que el selectorPrincipal no lleve \n literales
  const normalizedText = ((el.textContent || "")).replace(/\s+/g, " ").trim();
  return {
    tag: ((el.tagName || "").toLowerCase()) || null,
    text: (normalizedText.slice(0, 50)) || null,
    aria: el.getAttribute?.("aria-label") || null,
    testId: el.getAttribute?.("data-testid") || null,
  };
}

/** Convierte un elemento serializado a su `selectorPrincipal` JSON para PasoGrabado. */
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

/** Mejor selector disponible por prioridad: testid > role > id > aria-label > name > text > css. */
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
