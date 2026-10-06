/**
 * lib/worker/auto-repair.ts — auto-repair con selectores respaldo (HU-G15).
 *
 * Two halves:
 *
 * 1. `tryWithReparacion` — helper JS que se inyecta en el script generado
 *    (.spec.ts). Itera `candidates` (lista priorizada de selectores) y
 *    ejecuta `action(locator)` con el primero que resuelve un locator
 *    no-vacío. Devuelve `{ ok, usedIndex, error }`.
 *
 *    Si el principal falla por timeout (selector no encontrado), prueba
 *    cada respaldo en orden. Si uno funciona, marca el paso como
 *    `selfHealed=true` con `detalleReparacion="se usó respaldo por <strategy>"`.
 *
 * 2. `countReparadosFromPasos` — helper puro Node-side que cuenta pasos
 *    `selfHealed=true`. Usado por el UI "Reparados: N" counter.
 *
 * IMPORTANTE: el auto-repair sólo se activa cuando el paso tiene
 * `selectoresRespaldo` con >= 2 estrategias. Si solo hay principal,
 * `tryWithReparacion` se comporta como un `locator()` directo (sin
 * fallback) — comportamiento actual sin cambios.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ────────────────────────────────────────────────────────────────────────

/** Una estrategia de selector como la produce pickBestSelector. */
export interface SelectorCandidate {
  strategy: string;
  value: string;
  /** Opcional: name para `getByRole(role, { name })`. */
  name?: string;
}

/** Resultado de intentar la acción con cada candidato. */
export interface ReparacionResult<T> {
  ok: boolean;
  usedIndex: number; // índice en `candidates` que terminó usándose (0 = principal)
  selfHealed: boolean; // true si se usó un respaldo (usedIndex > 0)
  detalleReparacion: string | null; // ej. "se usó respaldo por testid"
  value: T | null; // valor retornado por `action(locator)` si ok
  error: Error | null; // último error si no hubo éxito
}

// ────────────────────────────────────────────────────────────────────────
// JS-side: tryWithReparacion (corre dentro del spec.ts generado)
// ────────────────────────────────────────────────────────────────────────

/**
 * Helper que se inyecta en el script generado. NO se ejecuta en Node —
 * vive como string en `serialize.ts` y se evalúa dentro del test de
 * Playwright.
 *
 * Estructura del código inyectado:
 *   ```js
 *   async function tryWithReparacion(page, candidates, action) {
 *     for (let i = 0; i < candidates.length; i++) {
 *       const c = candidates[i];
 *       const locator = buildLocator(page, c);
 *       try {
 *         // action debe lanzar si falla — wrap en Promise.race con timeout
 *         const result = await action(locator);
 *         return { ok: true, usedIndex: i, selfHealed: i > 0,
 *                  detalleReparacion: i > 0 ? `se usó respaldo por ${c.strategy}` : null,
 *                  value: result, error: null };
 *       } catch (err) {
 *         // continúa con el siguiente candidato
 *       }
 *     }
 *     return { ok: false, usedIndex: -1, selfHealed: false,
 *              detalleReparacion: null, value: null,
 *              error: new Error('Ningún selector funcionó') };
 *   }
 *
 *   function buildLocator(page, c) {
 *     switch (c.strategy) {
 *       case 'testid': return page.getByTestId(c.value);
 *       case 'role': return page.getByRole(c.value, c.name ? { name: c.name } : undefined);
 *       case 'id': return page.locator(`#${c.value}`);
 *       case 'aria-label': return page.getByLabel(c.value);
 *       case 'text': return page.getByText(c.value);
 *       case 'css':
 *       default: return page.locator(c.value);
 *     }
 *   }
 *   ```
 *
 * Esta función exporta el source string para que el serializer lo pueda
 * inyectar en el .spec.ts generado.
 */
export const TRY_WITH_REPARACION_SOURCE = `async function tryWithReparacion(page, candidates, action) {
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const locator = (function buildLocator(p, c) {
      switch (c.strategy) {
        case 'testid': return p.getByTestId(c.value);
        case 'role': return p.getByRole(c.value, c.name ? { name: c.name } : undefined);
        case 'id': return p.locator('#' + c.value);
        case 'aria-label': return p.getByLabel(c.value);
        case 'name': return p.locator('[name="' + c.value + '"]');
        case 'text': return p.getByText(c.value);
        case 'css':
        default: return p.locator(c.value);
      }
    })(page, c);
    try {
      const result = await action(locator);
      return {
        ok: true,
        usedIndex: i,
        selfHealed: i > 0,
        detalleReparacion: i > 0 ? 'se usó respaldo por ' + c.strategy : null,
        value: result,
        error: null,
      };
    } catch (err) {
      // continuar con el siguiente candidato
    }
  }
  return {
    ok: false,
    usedIndex: -1,
    selfHealed: false,
    detalleReparacion: null,
    value: null,
    error: new Error('Ningún selector funcionó'),
  };
}
`;

// ────────────────────────────────────────────────────────────────────────
// Node-side: countReparadosFromPasos (para el UI counter)
// ────────────────────────────────────────────────────────────────────────

export interface PasoEjecucionLite {
  selfHealed: boolean;
}

/**
 * Cuenta cuántos pasos fueron reparados (selfHealed=true).
 *
 * Usado por el componente <ReparadosCounter /> en la página de detalle
 * de ejecución. Es una función pura para testearla sin tocar Prisma.
 */
export function countReparadosFromPasos<T extends PasoEjecucionLite>(
  pasos: T[],
): number {
  return pasos.filter((p) => p.selfHealed === true).length;
}

// ────────────────────────────────────────────────────────────────────────
// JS-side: testing-friendly interface for the helper
// ────────────────────────────────────────────────────────────────────────

/**
 * Versión "intérprete" de tryWithReparacion, escrita en TypeScript para
 * poder testearla con mocks de page.locator sin necesidad de ejecutar
 * el código JS inyectado.
 *
 * Esta es la implementación de referencia que el código inyectado debe
 * emular. Si cambia la lógica inyectada, cambiar también esta función
 * y los tests que la validan.
 *
 * @param page objeto `page` o mock con `locator(...)`.
 * (NOTA: en runtime este código NO se ejecuta — el código inyectado
 * sí se ejecuta dentro del spec.ts. Esta función existe para tests.)
 */
export async function tryWithReparacionTs<T>(
  page: {
    locator: (sel: string) => { click: () => Promise<T>; fill: (v: string) => Promise<T> };
    getByTestId: (id: string) => { click: () => Promise<T>; fill: (v: string) => Promise<T> };
    getByRole: (
      role: string,
      opts?: { name?: string },
    ) => { click: () => Promise<T>; fill: (v: string) => Promise<T> };
    getByLabel: (label: string) => { click: () => Promise<T>; fill: (v: string) => Promise<T> };
    getByText: (text: string) => { click: () => Promise<T>; fill: (v: string) => Promise<T> };
  },
  candidates: SelectorCandidate[],
  action: (locator: { click: () => Promise<T>; fill: (v: string) => Promise<T> }) => Promise<T>,
): Promise<ReparacionResult<T>> {
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const locator = buildLocatorTs(page, c);
    try {
      const result = await action(locator);
      return {
        ok: true,
        usedIndex: i,
        selfHealed: i > 0,
        detalleReparacion: i > 0 ? `se usó respaldo por ${c.strategy}` : null,
        value: result,
        error: null,
      };
    } catch {
      // continue with next candidate
    }
  }
  return {
    ok: false,
    usedIndex: -1,
    selfHealed: false,
    detalleReparacion: null,
    value: null,
    error: new Error("Ningún selector funcionó"),
  };
}

function buildLocatorTs(
  page: any,
  c: SelectorCandidate,
): { click: () => Promise<any>; fill: (v: string) => Promise<any> } {
  switch (c.strategy) {
    case "testid":
      return page.getByTestId(c.value);
    case "role":
      return page.getByRole(c.value, c.name ? { name: c.name } : undefined);
    case "id":
      return page.locator(`#${c.value}`);
    case "aria-label":
      return page.getByLabel(c.value);
    case "text":
      return page.getByText(c.value);
    case "css":
    default:
      return page.locator(c.value);
  }
}