/**
 * Init script del browser para el modo grabador (HU-G3, HU-G4).
 *
 * Este script se inyecta en cada página nueva del BrowserContext vía
 * `context.addInitScript({ content: INIT_SCRIPT })`. Se ejecuta ANTES de
 * cualquier script del usuario, así que puede registrar listeners de
 * eventos del DOM sin perder el primer click/input.
 *
 * Responsabilidades:
 *   1. Capturar `click / input / change / keydown / submit` en captura
 *      (fase `true`) para llegar antes que handlers de la app.
 *   2. Calcular el delta (HU-G4 auto-wait) entre eventos consecutivos.
 *   3. Serializar el target (tag, role, text, aria, name, testId, bbox,
 *      candidates de selectores priorizados).
 *   4. Detectar campos `type="password"` y marcar el payload con
 *      `isPassword=true` y `value=null` (defense-in-depth en la capa
 *      browser — el init script NUNCA envía el valor en claro).
 *   5. Reportar al Node via `window.__pw_report(payload)` (función
 *      expuesta por Playwright en `context.exposeFunction`).
 *
 * SECURITY (HU-GR-1): si el evento target es `<input type="password">`,
 * el payload siempre lleva `value: null` y `isPassword: true`. El paso-repo
 * además enforce otra capa de defensa (`valor = esSensible ? null : value`).
 *
 * TESTING: este script se evalúa en el browser real (no en Jest). Los
 * tests verifican su forma (string, referencias obligatorias, eventos
 * cubiertos). La validación end-to-end requiere Playwright + browser.
 */

export const INIT_SCRIPT = `
(() => {
  const PASSWORD_TYPE = 'password';
  const EVENTS = ['click', 'input', 'change', 'keydown', 'submit'];

  let lastEventTime = Date.now();

  function normalizeSelectorText(raw) {
    if (typeof raw !== 'string') return '';
    let s = raw;
    try { s = s.normalize('NFC'); } catch (e) { /* ICU not available */ }
    s = s.replace(/[\\u00a0\\u1680\\u2000-\\u200a\\u2007\\u202f\\u205f\\u3000]/g, ' ');
    s = s.replace(/[\\u200b-\\u200f\\u2028\\u2029\\u2060\\ufeff]/g, '');
    s = s.replace(/[\\u0000-\\u001f\\u007f]/g, ' ');
    return s.replace(/\\s+/g, ' ').trim();
  }

  function isUsableTextSelector(text) {
    const t = normalizeSelectorText(text);
    if (t.length < 3) return false;
    if (t.length >= 30) return false;
    if (/[\\p{Ll}][\\p{Lu}]/u.test(t)) return false;
    return true;
  }

  function escapeSelectorText(text) {
    return text.replace(/"/g, '\\\\"');
  }

  function implicitRoleFor(tag, inputType) {
    const t = (tag || '').toLowerCase();
    if (t === 'input') {
      const type = (inputType || 'text').toLowerCase();
      switch (type) {
        case 'search': return 'searchbox';
        case 'checkbox': return 'checkbox';
        case 'radio': return 'radio';
        case 'range': return 'slider';
        case 'number': return 'spinbutton';
        case 'email':
        case 'tel':
        case 'url':
        case 'text': return 'textbox';
        case 'submit':
        case 'button':
        case 'reset':
        case 'image': return 'button';
        case 'password':
        case 'file':
        case 'hidden': return null;
        default: return 'textbox';
      }
    }
    if (t === 'button') return 'button';
    if (t === 'select') return 'combobox';
    if (t === 'textarea') return 'textbox';
    if (t === 'a') return 'link';
    if (t === 'nav') return 'navigation';
    if (t === 'main') return 'main';
    if (t === 'header') return 'banner';
    if (t === 'footer') return 'contentinfo';
    if (t === 'aside') return 'complementary';
    if (t === 'form') return 'form';
    if (t === 'table') return 'table';
    if (t === 'option') return 'option';
    if (t === 'h1' || t === 'h2' || t === 'h3' || t === 'h4' || t === 'h5' || t === 'h6') {
      return 'heading';
    }
    if (t === 'ul' || t === 'ol') return 'list';
    if (t === 'li') return 'listitem';
    return null;
  }

  function resolveRole(tag, explicitRole, inputType) {
    const explicit = normalizeSelectorText(explicitRole);
    if (explicit) return explicit;
    return implicitRoleFor(tag, inputType);
  }

  function accessibleNameFor(el) {
    if (!el) return '';
    const attr = function(n) {
      return typeof el.getAttribute === 'function' ? normalizeSelectorText(el.getAttribute(n)) : '';
    };
    const ariaLabel = attr('aria-label');
    if (ariaLabel) return ariaLabel;
    const doc = el.ownerDocument || null;
    const labelledBy = attr('aria-labelledby');
    if (labelledBy && doc && typeof doc.getElementById === 'function') {
      const joined = labelledBy.split(/\\s+/).map(function(id) {
        const node = doc.getElementById(id);
        return node && node.textContent ? node.textContent : '';
      }).join(' ');
      const name = normalizeSelectorText(joined);
      if (name) return name;
    }
    const id = el.id || '';
    if (id && doc && typeof doc.querySelector === 'function') {
      try {
        const lbl = doc.querySelector('label[for="' + id.replace(/"/g, '\\\\"') + '"]');
        const name = normalizeSelectorText(lbl && lbl.textContent ? lbl.textContent : '');
        if (name) return name;
      } catch (e) { /* selector invalido */ }
    }
    if (typeof el.closest === 'function') {
      try {
        const wrapping = el.closest('label');
        if (wrapping && wrapping !== el) {
          const name = normalizeSelectorText(wrapping.textContent || '');
          if (name) return name;
        }
      } catch (e) { /* ignore */ }
    }
    for (let i = 0; i < 3; i++) {
      const a = ['placeholder', 'title', 'alt'][i];
      const v = attr(a);
      if (v) return v;
    }
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return '';
    const text = normalizeSelectorText(el.textContent || '');
    return text.length > 0 && text.length < 80 ? text : '';
  }

  function serializeElement(el) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const inputType = (el.type || null);
    const explicitRole = (el.getAttribute && el.getAttribute('role')) || '';
    const semanticRole = resolveRole(tag, explicitRole, inputType);
    const role = semanticRole || tag;
    const accessibleName = accessibleNameFor(el);
    // FIX: usar normalizeSelectorText() (mismo algoritmo que el
    // Node-side dom-utils.ts) para colapsar NBSP / zero-width /
    // control chars / whitespace. Antes era solo .replace(/\\s+/g, ' ')
    // que dejaba NBSP y demas caracteres invisibles que el codegen
    // emitia literal y NO matcheaban el locator real.
    const text = normalizeSelectorText(el.textContent || '').slice(0, 50);
    // FIX bug: antes se colapsaba aria-label/name/id en un solo campo "aria"
    // y siempre se etiquetaba el candidato como "aria-label". Eso causaba
    // que el codegen emitiera \`page.getByLabel("username")\` para un input
    // que SOLO tenia id="username" (sin aria-label real) y por lo tanto
    // Playwright esperaba 180s sin encontrar el locator. Ahora cada
    // atributo se lee independientemente y el candidato solo se agrega si
    // el atributo REALMENTE existe en el elemento.
    const ariaLabel = normalizeSelectorText(el.getAttribute && el.getAttribute('aria-label') || '');
    const nameAttr = (el.getAttribute && el.getAttribute('name')) || '';
    const idAttr = el.id || '';
    const testId = (el.getAttribute && el.getAttribute('data-testid')) || '';
    const candidates = [];
    if (testId) candidates.push({ strategy: 'testid', value: '[data-testid="' + escapeSelectorText(testId) + '"]' });
    // HU-G14 / FIX bug 3: emitir candidato role SIEMPRE que exista un role
    // semantico (explicito o implicito), incluso si coincide con el tag.
    // Antes el guard \`role !== tag\` lo descartaba y el codegen caia a
    // getByLabel/getByText. Ahora agregamos \`name\` con el accessible name
    // para que el codegen emita \`getByRole('searchbox', { name: 'Buscar...' })\`.
    if (semanticRole) {
      const c = { strategy: 'role', value: semanticRole };
      if (accessibleName) c.name = accessibleName;
      candidates.push(c);
    }
    if (idAttr) candidates.push({ strategy: 'id', value: '#' + idAttr });
    if (ariaLabel) candidates.push({ strategy: 'aria-label', value: '[aria-label="' + escapeSelectorText(ariaLabel) + '"]' });
    if (nameAttr) candidates.push({ strategy: 'name', value: '[name="' + escapeSelectorText(nameAttr) + '"]' });
    // FIX: usar isUsableTextSelector para NO emitir \`text\` candidate cuando
    // el textContent es ruido (concatenado de hijos, <3 chars, etc).
    if (isUsableTextSelector(text)) candidates.push({ strategy: 'text', value: text });
    candidates.push({ strategy: 'css', value: cssPath(el) });
    const bbox = el.getBoundingClientRect ? {
      x: el.getBoundingClientRect().x,
      y: el.getBoundingClientRect().y,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height
    } : null;
    return { tag, role, text, testId, aria: ariaLabel, name: nameAttr, accessibleName: accessibleName, candidates, bbox };
  }

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    let cur = el;
    while (cur && cur.nodeType === 1) {
      let selector = cur.nodeName.toLowerCase();
      if (cur.id) {
        selector += '#' + cur.id;
        path.unshift(selector);
        break;
      }
      let sib = cur, nth = 1;
      while ((sib = sib.previousElementSibling) != null) {
        if (sib.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth !== 1) selector += ':nth-of-type(' + nth + ')';
      path.unshift(selector);
      cur = cur.parentNode;
    }
    return path.join(' > ');
  }

  function isPasswordField(el) {
    return !!(el && el.type && el.type.toLowerCase() === PASSWORD_TYPE);
  }

  function report(event) {
    const target = event.target;
    const now = Date.now();
    const delta = now - lastEventTime;
    lastEventTime = now;
    const passwd = isPasswordField(target);
    // SECURITY: passwords NEVER leave the browser as plain text.
    // We always send value=null + isPassword=true so the Node layer
    // can persist a masked descripcion without ever seeing the value.
    const payload = {
      type: event.type,
      target: serializeElement(target),
      value: passwd ? null : (target && 'value' in target ? target.value : null),
      timestamp: now,
      deltaFromPreviousMs: delta,
      isPassword: passwd
    };
    try {
      window.__pw_report(payload);
    } catch (err) {
      // If the bridge is gone (recorder stopped), swallow.
      // eslint-disable-next-line no-console
      console.warn('[recorder] __pw_report failed', err);
    }
  }

  EVENTS.forEach(function (t) {
    document.addEventListener(t, report, true);
  });
})();
`;
