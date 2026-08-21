// lib/worker/log-cap.ts
// Pure helper: FIFO cap for log buffers

export interface LogEntry {
  ts: string
  level: 'log' | 'info' | 'warn' | 'error' | 'debug'
  msg: string
  source: 'page' | 'console' | 'stderr' | 'stdout'
}

/**
 * Append a log entry to a buffer, capping to `max` entries via FIFO.
 * Returns a new array (immutable).
 */
export function capLogs(buffer: LogEntry[] | null | undefined, entry: LogEntry, max: number): LogEntry[] {
  const current = buffer ?? []
  const next = [...current, entry]
  if (next.length > max) {
    return next.slice(next.length - max)
  }
  return next
}
