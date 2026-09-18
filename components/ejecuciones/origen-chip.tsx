"use client";

/**
 * OrigenChip — HU-G17.
 *
 * Chip visual que muestra el origen de un CasoPrueba (`subirScript` |
 * `grabador` | `mixto`). Aparece en la pantalla de detalle de ejecución
 * para que el usuario distinga al vuelo si un caso fue subido como
 * script .spec.ts o grabado por el modo No-Code.
 *
 * Diseño (tokens M3, sin colores ad-hoc):
 *   - Azul info para `grabador` (acción capturada en vivo)
 *   - Gris neutro para `subirScript` (archivo subido)
 *   - Ámbar cálido para `mixto` (ambos modos)
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
    bg: "bg-m3-info-container",
    fg: "text-m3-info",
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
    bg: "bg-m3-warn-container",
    fg: "text-m3-on-secondary-container",
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label text-[11px] font-semibold ${style.bg} ${style.fg} ${className}`}
    >
      <span
        className="material-symbols-outlined text-[14px] leading-none"
        style={{ fontVariationSettings: "'FILL' 1" }}
        aria-hidden="true"
      >
        {style.icon}
      </span>
      {style.label}
    </span>
  );
}
