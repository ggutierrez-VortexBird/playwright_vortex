import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-4 -mt-4 border-b border-m3-outline-variant bg-m3-surface px-4 py-3 lg:-mx-6 lg:-mt-6 lg:px-6 lg:py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Grabación</h2>
      </div>
      <div className="flex h-[calc(100vh-220px)] min-h-[400px] items-center justify-center rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest">
        <div className="flex items-center gap-3 font-body text-body-md text-m3-on-surface-variant">
          <Skeleton className="h-3 w-3 rounded-full bg-m3-error" />
          <span>Conectando al grabador…</span>
        </div>
      </div>
    </div>
  );
}