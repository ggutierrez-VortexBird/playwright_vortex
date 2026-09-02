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
export function serializeElement(
  el: Element | null | undefined,
): SerializedElementFull | null {
  if (!el || (el as Node).nodeType !== 1) return null;

  const tag = (el.tagName || "").toLowerCase();
  const role =
    el.getAttribute?.("role") || tag;
  const aria =
    el.getAttribute?.("aria-label") ||
    el.getAttribute?.("name") ||
    el.getAttribute?.("id") ||
    "";
  const name = el.getAttribute?.("name") || "";
  const text = ((el.textContent || "").trim()).slice(0, 50);
  const testId = el.getAttribute?.("data-testid") || "";

  const candidates: Array<{ strategy: string; value: string }> = [];
  if (testId) {
    candidates.push({
      strategy: "testid",
      value: `[data-testid="${escapeSelectorText(testId)}"]`,
    });
  }
  // HU-G14: priorizar role explícito sobre id. Sólo si el role difiere
  // del tag (es decir, es un role semántico puesto por el dev).
  const explicitRole = el.getAttribute?.("role");
  if (explicitRole && explicitRole !== tag) {
    candidates.push({ strategy: "role", value: explicitRole });
  }
  if (el.id) {
    candidates.push({ strategy: "id", value: `#${el.id}` });
  }
  if (aria) {
    candidates.push({
      strategy: "aria-label",
      value: `[aria-label="${escapeSelectorText(aria)}"]`,
    });
  }
  if (name) {
    candidates.push({
      strategy: "name",
      value: `[name="${escapeSelectorText(name)}"]`,
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

  return { tag, role, text, testId, aria, name, candidates, bbox };
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
  return {
    tag: ((el.tagName || "").toLowerCase()) || null,
    text: ((el.textContent || "").trim()).slice(0, 50) || null,
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
