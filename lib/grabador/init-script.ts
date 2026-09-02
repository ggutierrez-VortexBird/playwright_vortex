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

  function serializeElement(el) {
    if (!el || el.nodeType !== 1) return null;
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const role = el.getAttribute && el.getAttribute('role') || tag;
    // FIX bug: antes se colapsaba aria-label/name/id en un solo campo "aria"
    // y siempre se etiquetaba el candidato como "aria-label". Eso causaba
    // que el codegen emitiera \`page.getByLabel("username")\` para un input
    // que SOLO tenia id="username" (sin aria-label real) y por lo tanto
    // Playwright esperaba 180s sin encontrar el locator. Ahora cada
    // atributo se lee independientemente y el candidato solo se agrega si
    // el atributo REALMENTE existe en el elemento.
    const ariaLabel = el.getAttribute && el.getAttribute('aria-label') || '';
    const nameAttr = el.getAttribute && el.getAttribute('name') || '';
    const text = (el.textContent || '').trim().slice(0, 50);
    const testId = el.getAttribute && el.getAttribute('data-testid') || '';
    const candidates = [];
    if (testId) candidates.push({ strategy: 'testid', value: '[data-testid="' + testId + '"]' });
    if (el.id) candidates.push({ strategy: 'id', value: '#' + el.id });
    if (ariaLabel) candidates.push({ strategy: 'aria-label', value: '[aria-label="' + ariaLabel + '"]' });
    if (nameAttr) candidates.push({ strategy: 'name', value: '[name="' + nameAttr + '"]' });
    if (text && text.length < 30) candidates.push({ strategy: 'text', value: text });
    candidates.push({ strategy: 'css', value: cssPath(el) });
    const bbox = el.getBoundingClientRect ? {
      x: el.getBoundingClientRect().x,
      y: el.getBoundingClientRect().y,
      width: el.getBoundingClientRect().width,
      height: el.getBoundingClientRect().height
    } : null;
    return { tag, role, text, testId, aria: ariaLabel, name: nameAttr, candidates, bbox };
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
