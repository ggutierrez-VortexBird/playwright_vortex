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
  const resultadoColor =
    estado === 'paso'
      ? 'var(--seal)'
      : estado === 'fallo'
        ? 'var(--stamp)'
        : estado === 'reparado'
          ? 'var(--amber)'
          : 'var(--ink)'

  return (
    <div className="run-stat">
      <div>
        <div className="k">Resultado</div>
        <div className="v" style={{ color: resultadoColor }}>
          {resultadoLabel}
        </div>
      </div>
      <div>
        <div className="k">Duración</div>
        <div className="v">{formatDuration(duracionMs)}</div>
      </div>
      <div>
        <div className="k">Inicio</div>
        <div className="v" style={{ fontSize: 13 }}>
          {formatTimestamp(inicioAt)}
        </div>
      </div>
      <div>
        <div className="k">Fin</div>
        <div className="v" style={{ fontSize: 13 }}>
          {formatTimestamp(finAt)}
        </div>
      </div>
    </div>
  )
}
