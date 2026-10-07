import { formatDuration, formatFecha } from '@/lib/format'
import { estadoTone, resultadoEjecucionLabel } from '@/lib/ejecuciones/estado'
import type { StatusBadgeTone } from '@/components/ui/status-badge'
import { TiempoTranscurrido } from './tiempo-transcurrido'

const COLOR_TONO: Record<StatusBadgeTone, string> = {
  success: 'text-m3-success',
  error: 'text-m3-error',
  warning: 'text-m3-warning',
  info: 'text-m3-info',
  neutral: 'text-m3-on-surface',
}

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

export function EjecucionSummary({
  estado,
  duracionMs,
  inicioAt,
  finAt,
  errorMsg,
  pasos,
}: Props) {
  const primerPasoFallido = pasos?.find(p => p.estado === 'fallo')
  const resultadoLabel = resultadoEjecucionLabel(estado, primerPasoFallido?.numero)
  const resultadoColorClass = COLOR_TONO[estadoTone(estado)]

  return (
    <div className="flex flex-wrap gap-6 border-b border-m3-outline-variant px-5 py-4">
      <div>
        <div className="font-label text-label-xs uppercase tracking-wide text-m3-on-surface-variant">
          Resultado
        </div>
        <div className={`mt-1 font-body text-headline-sm font-semibold ${resultadoColorClass}`}>
          {resultadoLabel}
        </div>
      </div>
      <div>
        <div className="font-label text-label-xs uppercase tracking-wide text-m3-on-surface-variant">
          Duración
        </div>
        <div className="mt-1 font-body text-headline-sm font-semibold tabular-nums text-m3-on-surface">
          {estado === 'corriendo' && inicioAt ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-m3-info motion-reduce:animate-none" aria-hidden="true" />
              <TiempoTranscurrido desde={inicioAt} />
            </span>
          ) : (
            formatDuration(duracionMs)
          )}
        </div>
      </div>
      <div>
        <div className="font-label text-label-xs uppercase tracking-wide text-m3-on-surface-variant">
          Inicio
        </div>
        <div className="mt-1 font-body text-body-sm font-semibold text-m3-on-surface">
          {formatFecha(inicioAt)}
        </div>
      </div>
      <div>
        <div className="font-label text-label-xs uppercase tracking-wide text-m3-on-surface-variant">
          Fin
        </div>
        <div className="mt-1 font-body text-body-sm font-semibold text-m3-on-surface">
          {formatFecha(finAt)}
        </div>
      </div>
    </div>
  )
}
