export function ErrorMotorBadge({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-m3-error bg-m3-error-container/40 px-2.5 py-1 font-label text-label-sm font-semibold uppercase tracking-wide text-m3-error">
        <span className="h-2 w-2 animate-pulse rounded-full bg-m3-error" aria-hidden="true" />
        Error motor
      </span>
      {message && (
        <span className="font-mono-code text-[11px] text-m3-error">{message}</span>
      )}
    </div>
  )
}
