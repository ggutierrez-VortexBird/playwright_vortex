interface Paso {
  id: string
  numero: number
  estado: string
}

interface Props {
  estado: string
  duracionMs: number | null
  inicioAt: Date | null
  finAt: Date | null
  errorMsg: string | null
  pasos?: Paso[]
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes > 0) return `${minutes}m ${remainder.toString().padStart(2, '0')}s`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTimestamp(d: Date | null): string {
  if (!d) return '—'
  return d.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EjecucionSummary({
  estado,
  duracionMs,
  inicioAt,
  finAt,
  errorMsg,
  pasos,
}: Props) {
  const primerPasoFallido = pasos?.find(p => p.estado === 'fallo')
  const pasoFalloLabel = primerPasoFallido
    ? `No conforme (paso ${primerPasoFallido.numero})`
    : 'No conforme'

  const resultadoLabel =
    estado === 'paso'
      ? 'Conforme'
      : estado === 'fallo'
        ? pasoFalloLabel
        : estado === 'reparado'
          ? 'Reparado'
          : estado === 'corriendo'
            ? 'Corriendo'
            : estado === 'pendiente'
              ? 'Pendiente'
              : estado === 'errorMotor'
                ? 'Error motor'
                : estado
  const resultadoColorClass =
    estado === 'paso'
      ? 'text-m3-on-tertiary-container'
      : estado === 'fallo'
        ? 'text-m3-error'
        : estado === 'reparado'
          ? 'text-m3-on-secondary-container'
          : 'text-m3-on-surface'

  return (
    <div className="flex flex-wrap gap-6 border-b border-m3-outline-variant px-5 py-4">
      <div>
        <div className="font-label text-[10.5px] uppercase tracking-wide text-m3-on-surface-variant">
          Resultado
        </div>
        <div className={`mt-1 font-body text-[17px] font-semibold ${resultadoColorClass}`}>
          {resultadoLabel}
        </div>
      </div>
      <div>
        <div className="font-label text-[10.5px] uppercase tracking-wide text-m3-on-surface-variant">
          Duración
        </div>
        <div className="mt-1 font-body text-[17px] font-semibold text-m3-on-surface">
          {formatDuration(duracionMs)}
        </div>
      </div>
      <div>
        <div className="font-label text-[10.5px] uppercase tracking-wide text-m3-on-surface-variant">
          Inicio
        </div>
        <div className="mt-1 font-body text-[13px] font-semibold text-m3-on-surface">
          {formatTimestamp(inicioAt)}
        </div>
      </div>
      <div>
        <div className="font-label text-[10.5px] uppercase tracking-wide text-m3-on-surface-variant">
          Fin
        </div>
        <div className="mt-1 font-body text-[13px] font-semibold text-m3-on-surface">
          {formatTimestamp(finAt)}
        </div>
      </div>
    </div>
  )
}
