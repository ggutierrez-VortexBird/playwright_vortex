'use client'

interface ExecutionStatusBarProps {
  passed: number
  failed: number
  skipped: number
  total: number
  className?: string
}

/**
 * Horizontal distribution bar showing passed/failed/skipped ratio.
 * Uses only M3 semantic tokens — replaces hex-hardcoded implementation.
 * Impeccable: layout + colorize + harden.
 */
export function ExecutionStatusBar({ passed, failed, skipped, total, className = '' }: ExecutionStatusBarProps) {
  if (total === 0) return null

  const passedPct = Math.round((passed / total) * 100)
  const failedPct = Math.round((failed / total) * 100)
  const skippedPct = Math.round((skipped / total) * 100)

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Proportional bar */}
      <div
        className="flex h-2 flex-1 overflow-hidden rounded-full bg-m3-surface-container-high"
        role="img"
        aria-label={`Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}`}
      >
        {passedPct > 0 && (
          <div
            className="bg-m3-success transition-all duration-300"
            style={{ width: `${passedPct}%` }}
          />
        )}
        {failedPct > 0 && (
          <div
            className="bg-m3-error transition-all duration-300"
            style={{ width: `${failedPct}%` }}
          />
        )}
        {skippedPct > 0 && (
          <div
            className="bg-m3-on-surface-variant transition-all duration-300"
            style={{ width: `${skippedPct}%` }}
          />
        )}
      </div>

      {/* Counts */}
      <div className="flex items-center gap-3 font-label text-label-sm">
        {passed > 0 && (
          <span className="flex items-center gap-1 text-m3-success">
            <span className="font-semibold">{passed}</span>
            <span className="text-m3-on-surface-variant">pasó</span>
          </span>
        )}
        {failed > 0 && (
          <span className="flex items-center gap-1 text-m3-error">
            <span className="font-semibold">{failed}</span>
            <span className="text-m3-on-surface-variant">falló</span>
          </span>
        )}
        {skipped > 0 && (
          <span className="flex items-center gap-1 text-m3-on-surface-variant">
            <span className="font-semibold">{skipped}</span>
            <span>omitido</span>
          </span>
        )}
      </div>
    </div>
  )
}
