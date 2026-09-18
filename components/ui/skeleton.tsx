import { cn } from "@/lib/utils";

/**
 * Bloque base de skeleton — un solo lugar para el tratamiento visual
 * (pulse + color), el tamaño se controla vía `className` en cada call site.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-m3-surface-container-high", className)} />;
}

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

/**
 * Shell de tabla en skeleton — mismo contenedor canónico que las tablas
 * reales (rounded-lg + border + shadow-card), para que la carga no "salte"
 * de layout cuando llegan los datos. Reemplaza los skeletons hand-rolled de
 * app/(dashboard)/casos/loading.tsx y app/(dashboard)/proyectos/[id]/casos/loading.tsx.
 */
export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card">
      <div className="flex items-center gap-4 border-b border-m3-outline-variant bg-m3-surface-container px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-m3-outline-variant">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
