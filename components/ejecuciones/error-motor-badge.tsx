export function ErrorMotorBadge({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="stamp">ERROR MOTOR</span>
      <span className="text-sm text-[--stamp]">{message}</span>
    </div>
  )
}
