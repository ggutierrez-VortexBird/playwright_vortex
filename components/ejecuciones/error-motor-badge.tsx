export function ErrorMotorBadge({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="stamp">
        <span className="ink" aria-hidden="true" />
        Error motor
      </span>
      {message && (
        <span className="font-mono text-[11px] text-stamp">{message}</span>
      )}
    </div>
  )
}
