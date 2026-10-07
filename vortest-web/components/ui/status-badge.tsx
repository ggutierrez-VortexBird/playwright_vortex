import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { estadoVisual, resultadoEjecucionLabel, type EstadoContexto } from "@/lib/ejecuciones/estado";

export type StatusBadgeTone = "success" | "error" | "warning" | "info" | "neutral";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusBadgeTone;
  /** Ícono Material Symbols; si no se pasa se usa el del tono, para que el estado nunca dependa sólo del color. */
  icon?: string;
  children: React.ReactNode;
}

const TONE_CLASSNAMES: Record<StatusBadgeTone, string> = {
  success: "bg-m3-success-container text-m3-on-success-container",
  error: "bg-m3-error-container text-m3-on-error-container",
  warning: "bg-m3-warning-container text-m3-on-warning-container",
  info: "bg-m3-info-container text-m3-on-info-container",
  neutral: "bg-m3-surface-container-high text-m3-on-surface-variant ring-1 ring-inset ring-m3-outline-variant",
};

const TONE_ICON: Record<StatusBadgeTone, string> = {
  success: "check_circle",
  error: "cancel",
  warning: "warning",
  info: "info",
  neutral: "radio_button_unchecked",
};

export function StatusBadge({ tone, icon, children, className, ...rest }: StatusBadgeProps) {
  const nombre = icon ?? TONE_ICON[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-1.5 pr-2.5 font-label text-label-sm font-medium",
        TONE_CLASSNAMES[tone],
        className
      )}
      {...rest}
    >
      <Icon name={nombre} size={14} filled={tone !== "neutral"} className={cn(nombre === "progress_activity" && "animate-spin")} />
      {children}
    </span>
  );
}

interface EstadoBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  estado: string;
  contexto?: EstadoContexto;
  /** Número del primer paso no conforme, para "No conforme · paso 3". */
  primerPasoFallido?: number | null;
}

/** Badge de un estado del dominio: etiqueta, tono e ícono salen de lib/ejecuciones/estado.ts. */
export function EstadoBadge({ estado, contexto = "ejecucion", primerPasoFallido, ...rest }: EstadoBadgeProps) {
  const visual = estadoVisual(estado, contexto);
  const label = contexto === "ejecucion" ? resultadoEjecucionLabel(estado, primerPasoFallido) : visual.label;
  return (
    <StatusBadge tone={visual.tone} icon={visual.icon} {...rest}>
      {label}
    </StatusBadge>
  );
}
