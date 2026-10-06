"use client";

/**
 * ReparadosCounter — HU-G15 UI counter.
 *
 * Muestra "Reparados: N" en la pantalla de detalle de una ejecución.
 * N = pasos donde `selfHealed=true` (la runner usó un selector de respaldo
 * para continuar en vez de fallar).
 *
 * Visibilidad:
 *   - Solo aparece cuando N >= 1 (no se muestra si nadie fue reparado).
 *   - Color ámbar/dorado para distinguir del verde "paso" normal.
 *
 * Reutiliza el helper puro `countReparadosFromPasos` de `lib/worker/auto-repair`
 * — así la lógica es testeable sin DOM.
 */

import { countReparadosFromPasos, type PasoEjecucionLite } from "@/lib/worker/auto-repair";

export interface ReparadosCounterProps {
  pasos: PasoEjecucionLite[];
}

export function ReparadosCounter({ pasos }: ReparadosCounterProps) {
  const count = countReparadosFromPasos(pasos);
  if (count === 0) return null;

  return (
    <span
      data-testid="reparados-counter"
      data-count={count}
      className="inline-flex items-center gap-1.5 rounded-full border border-m3-secondary/30 bg-m3-secondary-container/25 px-2.5 py-1 font-label text-label-sm font-medium text-m3-on-secondary-container"
      title={`${count} paso(s) continuaron usando un selector de respaldo`}
    >
      <span
        className="material-symbols-outlined text-[14px]"
        aria-hidden="true"
      >
        build
      </span>
      <span>Reparados: {count}</span>
    </span>
  );
}