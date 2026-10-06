import { Skeleton } from "@/components/ui/skeleton";

// El listado real agrupa ejecuciones por proyecto en secciones (no es una
// <table>), así que se arma a mano con Skeleton en vez de forzar
// TableSkeleton (que asume una fila de encabezado que este layout no tiene).
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-1 h-4 w-56" />
      </div>
      <div className="flex flex-col gap-8">
        {[1, 2].map((section) => (
          <div key={section} className="flex flex-col gap-3">
            <Skeleton className="h-4 w-32" />
            <div className="overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
              {[1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex items-center gap-3.5 border-b border-m3-outline-variant px-5 py-4 last:border-b-0"
                >
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
