import { Skeleton } from "@/components/ui/skeleton";

export default function ProyectosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-4"
          >
            <Skeleton className="h-4 w-20" />
            <Skeleton className="mt-2 h-6 w-32" />
            <div className="mt-4 grid grid-cols-3 gap-4 border-t border-m3-outline-variant pt-4">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
