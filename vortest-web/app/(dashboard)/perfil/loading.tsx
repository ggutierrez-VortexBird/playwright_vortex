import { Skeleton } from "@/components/ui/skeleton";

export default function PerfilLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="flex max-w-2xl flex-col gap-6">
        <Skeleton className="h-56 w-full rounded-md" />
        <Skeleton className="h-72 w-full rounded-md" />
      </div>
    </div>
  );
}
