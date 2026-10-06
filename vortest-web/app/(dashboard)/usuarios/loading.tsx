import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function UsuariosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <TableSkeleton rows={5} columns={5} />
    </div>
  );
}
