export default function CasosLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 animate-pulse rounded bg-rule-soft" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-rule-soft" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded bg-rule-soft" />
      </div>
      <div className="space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-rule-soft" />
        <div className="overflow-hidden rounded-lg border border-rule bg-surface">
          <div className="h-10 animate-pulse bg-rule-soft" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse bg-rule-soft/50" />
          ))}
        </div>
      </div>
    </div>
  );
}
