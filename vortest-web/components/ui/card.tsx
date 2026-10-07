import { cn } from "@/lib/utils";

/** Superficie base de la app: fondo, borde, radio y sombra en un solo lugar. */
export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card", className)}
      {...rest}
    />
  );
}

interface CardHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Nivel del encabezado, para mantener la jerarquía de la página. */
  as?: "h2" | "h3";
  className?: string;
}

export function CardHeader({ title, description, actions, as: Tag = "h2", className }: CardHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-m3-outline-variant px-5 py-4", className)}>
      <div className="min-w-0">
        <Tag className="font-headline text-headline-sm text-m3-on-surface">{title}</Tag>
        {description && <p className="mt-0.5 font-body text-body-sm text-m3-on-surface-variant">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...rest} />;
}
