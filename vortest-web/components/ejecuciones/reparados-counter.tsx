"use client";

/** Muestra "Reparados: N" (pasos con selfHealed=true); solo aparece si N >= 1. */

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
      <span aria-hidden="true"
        className="material-symbols-outlined text-[14px]"
      >
        build
      </span>
      <span>Reparados: {count}</span>
    </span>
  );
}