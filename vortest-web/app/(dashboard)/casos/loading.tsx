import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function CasosLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <TableSkeleton rows={3} columns={6} />
      </div>
    </div>
  );
}
