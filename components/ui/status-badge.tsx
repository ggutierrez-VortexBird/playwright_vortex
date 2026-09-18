import { cn } from "@/lib/utils";

export type StatusBadgeTone = "success" | "error" | "warning" | "info" | "reparado" | "neutral";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: StatusBadgeTone;
  children: React.ReactNode;
}

// Paridad exacta con el mapeo tono→clase ya en uso en
// components/casos/caso-table.tsx y components/ejecuciones/ejecucion-status.tsx
// (no se inventan colores nuevos, solo se centraliza la lógica).
const TONE_CLASSNAMES: Record<StatusBadgeTone, string> = {
  success: "bg-m3-success-container text-m3-success",
  error: "bg-m3-danger-container text-m3-error",
  warning: "bg-m3-warn-container text-m3-secondary",
  info: "bg-m3-info-container text-m3-info",
  reparado: "bg-m3-reparado-container text-m3-reparado",
  neutral: "bg-m3-surface-container-high text-m3-on-surface-variant",
};

/**
 * Píldora de estado canónica — reemplaza los `<span>` de badge repetidos a
 * mano en cada tabla/lista (caso-table, ejecucion-status, etc.).
 */
export function StatusBadge({ tone, children, className, ...rest }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 font-label text-label-sm font-medium",
        TONE_CLASSNAMES[tone],
        className
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
