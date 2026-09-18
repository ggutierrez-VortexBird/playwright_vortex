"use client";

import { cn } from "@/lib/utils";

export type KpiAccent = "primary" | "secondary" | "success" | "warning" | "danger";
export type KpiDensity = "compact" | "comfortable";

interface KpiTileProps {
  label: string;
  value: number | string;
  /** Optional sub-value or context line (e.g. "42 ok · 3 fallos") */
  sub?: string;
  /** Optional trend indicator */
  trend?: { direction: "up" | "down" | "neutral"; value: string };
  /** Semantic accent for the value color */
  accent?: KpiAccent;
  /** Visual weight variant */
  density?: KpiDensity;
  /** Optional Material Symbol icon rendered above the label */
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

/**
 * Canonical KPI stat card — resolves Issue #17 (media): 4 stat cards identical.
 *
 * Anatomy (comfortable):
 *   rounded-xl shadow-card p-5 bg-m3-surface-container-lowest
 *   accent variant adds border-left 4px
 *   label: font-label text-label-sm title-case uppercase tracking-wide
 *   value: font-headline text-display-md (or text-headline-lg for accent)
 *
 * Hover: shadow-card-hover + translateY(-1px) spring physics
 * prefers-reduced-motion: only shadow transition, no translate
 */
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
        "group relative rounded-xl bg-m3-surface-container-lowest shadow-card",
        "transition-shadow duration-200",
        "hover:shadow-card-hover",
        density === "compact" && "p-4",
        density === "comfortable" && "p-5",
        className
      )}
    >
      {/* Reduced motion: skip translate */}
      <div
        className={cn(
          "transition-transform duration-200",
          // No translate on hover for reduced-motion users
          "group-hover:translate-y-[-1px]",
          "media-reduced-motion:group-hover:translate-y-0"
        )}
      >
        {/* Icon */}
        {icon && (
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-m3-surface-container-high">
            <span className="material-symbols-outlined text-[20px] text-m3-on-surface-variant">
              {icon}
            </span>
          </div>
        )}

        {/* Label */}
        <div className="font-label text-label-sm font-medium uppercase tracking-wide text-m3-on-surface-variant">
          {label}
        </div>

        {/* Value row */}
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className={cn("font-headline leading-none", isAccent ? "text-display-md font-bold" : "text-headline-lg font-bold", ACCENT_CLASSNAMES[accent])}>
            {value}
          </div>

          {/* Trend badge */}
          {trend && (
            <div className={cn("flex items-center gap-0.5 font-label text-label-sm", TREND_COLORS[trend.direction])}>
              <span className="material-symbols-outlined text-[14px]">
                {TREND_ICONS[trend.direction]}
              </span>
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        {/* Sub-context line */}
        {sub && (
          <div className="mt-1.5 font-body text-body-xs text-m3-on-surface-variant">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
