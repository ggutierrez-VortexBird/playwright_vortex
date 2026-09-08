"use client";

/**
 * OrigenChip — HU-G17.
 *
 * Chip visual que muestra el origen de un CasoPrueba (`subirScript` |
 * `grabador` | `mixto`). Aparece en la pantalla de detalle de ejecución
 * para que el usuario distinga al vuelo si un caso fue subido como
 * script .spec.ts o grabado por el modo No-Code.
 *
 * Diseño:
 *   - Color ámbar para `grabador` (consistente con el grabador UI)
 *   - Color gris/azul para `subirScript` (consistente con upload UI)
 *   - Color púrpura para `mixto` (ambos modos)
 */

import type { CasoOrigen } from "@prisma/client";

export interface OrigenChipProps {
  origen: CasoOrigen | string;
  /** Override className for the wrapper. */
  className?: string;
}

const STYLES: Record<string, { label: string; bg: string; fg: string; icon: string }> = {
  grabador: {
    label: "Origen: Grabador",
    bg: "bg-m3-secondary-container/25",
    fg: "text-m3-on-secondary-container",
    icon: "videocam",
  },
  subirScript: {
    label: "Origen: Subir Script",
    bg: "bg-m3-surface-container-high",
    fg: "text-m3-on-surface-variant",
    icon: "terminal",
  },
  mixto: {
    label: "Origen: Mixto",
    bg: "bg-purple-100",
    fg: "text-purple-800",
    icon: "merge_type",
  },
};

export function OrigenChip({ origen, className = "" }: OrigenChipProps) {
  const style = STYLES[origen] ?? {
    label: `Origen: ${origen}`,
    bg: "bg-m3-surface-container-high",
    fg: "text-m3-on-surface-variant",
    icon: "help",
  };

  return (
    <span
      data-testid="origen-chip"
      data-origen={origen}
      title={style.label}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.fg} ${className}`}
    >
      <span
        className="material-symbols-outlined text-[12px]"
        style={{ fontVariationSettings: "'FILL' 1" }}
        aria-hidden="true"
      >
        {style.icon}
      </span>
      {style.label}
    </span>
  );
}
