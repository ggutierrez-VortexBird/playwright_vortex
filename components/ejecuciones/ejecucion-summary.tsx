interface Props {
  estado: string
  duracionMs: number | null
  inicioAt: Date | null
  finAt: Date | null
  errorMsg: string | null
}

export function EjecucionSummary({ estado, duracionMs, inicioAt, finAt, errorMsg }: Props) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-4">
        <div>
          <span className="text-[--rule]">Duración:</span>{' '}
          <span className="font-mono">
            {duracionMs ? `${(duracionMs / 1000).toFixed(2)}s` : '—'}
          </span>
        </div>
        <div>
          <span className="text-[--rule]">Inicio:</span>{' '}
          <span>{inicioAt ? inicioAt.toLocaleString() : '—'}</span>
        </div>
        <div>
          <span className="text-[--rule]">Fin:</span>{' '}
          <span>{finAt ? finAt.toLocaleString() : '—'}</span>
        </div>
      </div>
      {errorMsg && (
        <div className="p-2 bg-[--stamp] text-white rounded text-xs">
          {errorMsg}
        </div>
      )}
    </div>
  )
}
