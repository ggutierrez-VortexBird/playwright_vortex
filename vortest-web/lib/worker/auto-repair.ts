// Auto-repair con selectores respaldo: `tryWithReparacion` (inyectado en el spec) y `countReparadosFromPasos` (conteo en Node).

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Estrategia de selector como la produce pickBestSelector. */
export interface SelectorCandidate {
  strategy: string;
  value: string;
  /** Name opcional para `getByRole(role, { name })`. */
  name?: string;
}

/** Resultado de intentar la acción con cada candidato. */
export interface ReparacionResult<T> {
  ok: boolean;
  usedIndex: number; // índice en `candidates` usado (0 = principal)
  selfHealed: boolean; // true si se usó un respaldo (usedIndex > 0)
  detalleReparacion: string | null; // ej. "se usó respaldo por testid"
  value: T | null; // valor devuelto por `action(locator)` si ok
  error: Error | null; // último error si no hubo éxito
}

/** Código fuente de `tryWithReparacion`, inyectado como string en el spec generado (no corre en Node). */
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

export interface PasoEjecucionLite {
  selfHealed: boolean;
}

/** Cuenta los pasos reparados (selfHealed=true); función pura. */
export function countReparadosFromPasos<T extends PasoEjecucionLite>(
  pasos: T[],
): number {
  return pasos.filter((p) => p.selfHealed === true).length;
}

/** Versión en TypeScript de tryWithReparacion para testear con mocks; debe mantenerse equivalente al código inyectado. */
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
      // continúa con el siguiente candidato
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