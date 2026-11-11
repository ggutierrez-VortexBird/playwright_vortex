export interface LogEntry {
  ts: string
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  msg: string
  source: 'page' | 'console' | 'stderr' | 'stdout'
}

/** Agrega una entrada al buffer limitando a `max` (FIFO); retorna un array nuevo */
export function capLogs(buffer: LogEntry[] | null | undefined, entry: LogEntry, max: number): LogEntry[] {
  const current = buffer ?? []
  const next = [...current, entry]
  if (next.length > max) {
    return next.slice(next.length - max)
  }
  return next
}
