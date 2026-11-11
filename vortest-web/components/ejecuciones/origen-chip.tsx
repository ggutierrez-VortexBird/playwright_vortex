/** Chip con el origen del caso: subirScript, grabador o mixto. */

import type { CasoOrigen } from "@prisma/client";

export interface OrigenChipProps {
  origen: CasoOrigen | string;
  /** className adicional para el contenedor. */
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-label text-label-xs font-semibold ${style.bg} ${style.fg} ${className}`}
    >
      <span aria-hidden="true"
        className="material-symbols-outlined text-[14px] leading-none"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        {style.icon}
      </span>
      {style.label}
    </span>
  );
}
