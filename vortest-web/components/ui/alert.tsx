import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { StatusBadgeTone } from "@/components/ui/status-badge";

interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: StatusBadgeTone;
  title?: string;
  children?: React.ReactNode;
  /** Acción a la derecha (p. ej. un botón "Reintentar"). */
  action?: React.ReactNode;
  className?: string;
}

const TONO: Record<StatusBadgeTone, { caja: string; icono: string }> = {
  success: { caja: "border-m3-success/30 bg-m3-success-container text-m3-on-success-container", icono: "check_circle" },
  error: { caja: "border-m3-error/30 bg-m3-error-container text-m3-on-error-container", icono: "error" },
  warning: { caja: "border-m3-warning/30 bg-m3-warning-container text-m3-on-warning-container", icono: "warning" },
  info: { caja: "border-m3-info/30 bg-m3-info-container text-m3-on-info-container", icono: "info" },
  neutral: { caja: "border-m3-outline-variant bg-m3-surface-container text-m3-on-surface", icono: "info" },
};

/** Mensaje en línea: los errores se anuncian al aparecer (role="alert"), el resto con role="status". */
export function Alert({ tone = "info", title, children, action, className, ...rest }: AlertProps) {
  const t = TONO[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      {...rest}
      className={cn("flex items-start gap-3 rounded-md border px-4 py-3 font-body text-body-sm", t.caja, className)}
    >
      <Icon name={t.icono} size={20} filled className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
