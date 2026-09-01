/**
 * Tests for components/grabador/use-pasos-en-vivo.ts — live paso subscription.
 *
 * HU-G3: the hook listens to window 'grabador-paso' CustomEvents (dispatched
 * by grabador-client when the WS receives `paso_agregado`). Tests cover:
 *   - Initial state from `initialPasos`
 *   - Event append with the right sesionId
 *   - Filtering events for a different sesionId
 *   - Dedupe by id (defense against double-broadcast)
 *   - Cleanup on unmount
 */

import { renderHook, act } from "@testing-library/react";
import {
  usePasosEnVivo,
  PASO_AGREGADO_EVENT,
  type PasoEnVivo,
} from "@/components/grabador/use-pasos-en-vivo";

function makePaso(overrides: Partial<PasoEnVivo> = {}): PasoEnVivo {
  return {
    id: "paso-1",
    numero: 1,
    tipo: "clic",
    descripcion: "Clic en «Ingresar»",
    valor: null,
    esValorSensible: false,
    parametroNombre: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("usePasosEnVivo", () => {
  it("returns the initialPasos as initial state", () => {
    const initial = [
      makePaso({ id: "p-1", numero: 1 }),
      makePaso({ id: "p-2", numero: 2 }),
    ];
    const { result } = renderHook(() => usePasosEnVivo("ses-1", initial));
    expect(result.current).toHaveLength(2);
    expect(result.current[0].id).toBe("p-1");
    expect(result.current[1].id).toBe("p-2");
  });

  it("returns empty array by default", () => {
    const { result } = renderHook(() => usePasosEnVivo("ses-1"));
    expect(result.current).toEqual([]);
  });

  it("appends a paso when a matching 'grabador-paso' event fires", () => {
    const { result } = renderHook(() => usePasosEnVivo("ses-1", []));

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-1", numero: 1 }),
        }),
      );
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("p-1");
  });

  it("does nothing when sesionId is empty", () => {
    const { result } = renderHook(() => usePasosEnVivo("", []));

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-1", numero: 1 }),
        }),
      );
    });

    expect(result.current).toEqual([]);
  });

  it("ignores events whose sesionId doesn't match", () => {
    const { result } = renderHook(() => usePasosEnVivo("ses-1", []));

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: { ...makePaso({ id: "p-x" }), sesionId: "ses-OTHER" },
        }),
      );
    });

    expect(result.current).toEqual([]);
  });

  it("accepts events that include sesionId matching the hook", () => {
    const { result } = renderHook(() => usePasosEnVivo("ses-1", []));

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: { ...makePaso({ id: "p-1" }), sesionId: "ses-1" },
        }),
      );
    });

    expect(result.current).toHaveLength(1);
  });

  it("dedupes events with the same paso id", () => {
    const { result } = renderHook(() => usePasosEnVivo("ses-1", []));

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-1", numero: 1 }),
        }),
      );
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-1", numero: 1 }),
        }),
      );
    });

    expect(result.current).toHaveLength(1);
  });

  it("ignores malformed events (missing required fields)", () => {
    const { result } = renderHook(() => usePasosEnVivo("ses-1", []));

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: { id: "no-numero" }, // missing numero/tipo/descripcion/createdAt
        }),
      );
    });

    expect(result.current).toEqual([]);
  });

  it("cleans up the event listener on unmount", () => {
    const { result, unmount } = renderHook(() => usePasosEnVivo("ses-1", []));

    unmount();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(PASO_AGREGADO_EVENT, {
          detail: makePaso({ id: "p-1", numero: 1 }),
        }),
      );
    });

    expect(result.current).toEqual([]);
  });
});
