/**
 * Formato canónico de duraciones y fechas (DUP-01).
 *
 * El formato por defecto replica byte a byte las copias que existían en
 * `ejecucion-summary`, `ejecuciones-list` y `lib/acta/template.ts` (Acta PDF).
 * Las variantes históricas (solo segundos, `< 1000 ms`, rango entre dos fechas,
 * día numérico) se conservan mediante `opts` para no cambiar lo que ve el
 * usuario; unificarlas es una decisión de producto pendiente.
 */

// Locale histórico del producto. NO cambiar a es-CO sin decisión de producto:
// es-CO usa reloj de 12 h ("a. m.") y alteraría el Acta PDF.
export const LOCALE = 'es-ES'

// Fija la zona para que el render del servidor (UTC en Docker) y el del navegador coincidan; sin esto React reporta hydration mismatch y el Acta imprime horas en UTC.
export const TIME_ZONE = 'America/Bogota'

export interface FormatDurationOpts {
  /** Siempre `X.Xs` (nunca `Xm SSs`): variante de paso/subacción. */
  soloSegundos?: boolean
  /** Por debajo de 1000 ms muestra `Nms`: variante del timeline. */
  milisegundos?: boolean
  /** Texto cuando `ms` es null/undefined. Por defecto `—`. */
  vacio?: string
}

export function formatDuration(
  ms: number | null | undefined,
  opts: FormatDurationOpts = {}
): string {
  if (ms == null) return opts.vacio ?? '—'
  if (opts.milisegundos && ms < 1000) return `${ms}ms`
  if (!opts.soloSegundos) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainder = seconds % 60
    if (minutes > 0) return `${minutes}m ${remainder.toString().padStart(2, '0')}s`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

/** Duración entre dos fechas (variante de `ActaHeader`): `Ns`, `Nm Ns`, `Nh Nm`. */
export function formatDurationRange(inicio: Date, fin: Date): string {
  const diffMs = fin.getTime() - inicio.getTime()
  if (diffMs < 0) return '—'
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remainingSecs = secs % 60
  if (mins < 60) return `${mins}m ${remainingSecs}s`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}h ${remainingMins}m`
}

export interface FormatFechaOpts {
  /** Incluir año. Por defecto true. */
  anio?: boolean
  /** Incluir hora y minutos. Por defecto true. */
  hora?: boolean
  /** Formato del día. Por defecto `2-digit` (`caso-table` usa `numeric`). */
  dia?: '2-digit' | 'numeric'
}

export function formatFecha(
  d: Date | string | null | undefined,
  opts: FormatFechaOpts = {}
): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  const { anio = true, hora = true, dia = '2-digit' } = opts
  return date.toLocaleString(LOCALE, {
    timeZone: TIME_ZONE,
    ...(anio ? { year: 'numeric' as const } : {}),
    month: 'short',
    day: dia,
    ...(hora ? { hour: '2-digit' as const, minute: '2-digit' as const } : {}),
  })
}
