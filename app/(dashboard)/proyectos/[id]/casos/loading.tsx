export default function ProyectoCasosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="h-8 w-56 animate-pulse rounded bg-m3-surface-container-high" />
        <div className="mt-2 h-4 w-48 animate-pulse rounded bg-m3-surface-container-high" />
      </div>
      <div className="space-y-4">
        <div className="h-10 animate-pulse bg-m3-surface-container-high" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse bg-m3-surface-container-high/50" />
        ))}
      </div>
    </div>
  );
}
