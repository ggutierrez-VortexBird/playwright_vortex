import { cn } from "@/lib/utils";

export type KpiAccent = "primary" | "secondary" | "success" | "warning" | "danger";
export type KpiDensity = "compact" | "comfortable";

interface KpiTileProps {
  label: string;
  value: number | string;
  /** Subvalor o línea de contexto (p. ej. "42 ok · 3 fallos") */
  sub?: string;
  /** Indicador de tendencia opcional */
  trend?: { direction: "up" | "down" | "neutral"; value: string };
  /** Acento semántico para el color del valor */
  accent?: KpiAccent;
  /** Variante de peso visual */
  density?: KpiDensity;
  /** Ícono Material Symbol opcional sobre la etiqueta */
  icon?: string;
  className?: string;
}

const ACCENT_CLASSNAMES: Record<KpiAccent, string> = {
  primary: "text-m3-primary",
  secondary: "text-m3-secondary",
  success: "text-m3-tertiary",
  warning: "text-m3-warning",
  danger: "text-m3-error",
};

const TREND_ICONS: Record<string, string> = {
  up: "trending_up",
  down: "trending_down",
  neutral: "trending_flat",
};

const TREND_COLORS: Record<string, string> = {
  up: "text-m3-tertiary",
  down: "text-m3-error",
  neutral: "text-m3-on-surface-variant",
};

/** Tarjeta KPI: acento con borde izquierdo y hover con elevación (solo sombra con prefers-reduced-motion). */
export function KpiTile({
  label,
  value,
  sub,
  trend,
  accent = "secondary",
  density = "comfortable",
  icon,
  className,
}: KpiTileProps) {
  const isAccent = accent !== "secondary";

  return (
    <div
      className={cn(
        "group relative rounded-md bg-m3-surface-container-lowest shadow-card",
        "transition-shadow duration-200",
        "hover:shadow-card-hover",
        density === "compact" && "p-4",
        density === "comfortable" && "p-5",
        className
      )}
    >
      <div
        className={cn(
          "transition-transform duration-200",
          "group-hover:translate-y-[-1px]",
          "motion-reduce:group-hover:translate-y-0"
        )}
      >
        {icon && (
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-m3-surface-container-high">
            <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-m3-on-surface-variant">
              {icon}
            </span>
          </div>
        )}

        <div className="font-label text-label-sm font-medium uppercase tracking-wide text-m3-on-surface-variant">
          {label}
        </div>

        <div className="mt-1 flex items-end justify-between gap-2">
          <div className={cn("font-headline leading-none", isAccent ? "text-display-md font-bold" : "text-headline-lg font-bold", ACCENT_CLASSNAMES[accent])}>
            {value}
          </div>

          {trend && (
            <div className={cn("flex items-center gap-0.5 font-label text-label-sm", TREND_COLORS[trend.direction])}>
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                {TREND_ICONS[trend.direction]}
              </span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        {sub && (
          <div className="mt-1.5 font-body text-body-xs text-m3-on-surface-variant">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
