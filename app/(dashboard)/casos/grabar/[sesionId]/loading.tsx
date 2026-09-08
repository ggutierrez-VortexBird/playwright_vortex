export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-6 -mt-6 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Grabación</h2>
      </div>
      <div className="flex h-[calc(100vh-220px)] min-h-[400px] items-center justify-center rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest">
        <div className="flex items-center gap-3 font-body text-body-md text-m3-on-surface-variant">
          <span className="h-3 w-3 animate-pulse rounded-full bg-m3-error" />
          <span>Conectando al grabador…</span>
        </div>
      </div>
    </div>
  );
}