import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ProyectoCasosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
      <TableSkeleton rows={3} columns={6} />
    </div>
  );
}
