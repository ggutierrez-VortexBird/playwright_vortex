import { StatusBadge } from '@/components/ui/status-badge'
import { estadoLabel, estadoTone } from '@/lib/ejecuciones/estado'

interface Paso {
  id: string
  numero: number
  estado: string
}

interface EjecucionStatusProps {
  estado: string
  pasos?: Paso[]
}

export function EjecucionStatus({ estado, pasos }: EjecucionStatusProps) {
  let label = estadoLabel(estado, 'ejecucion')
  if (estado === 'fallo' && pasos) {
    const primerPasoFallido = pasos.find(p => p.estado === 'fallo')
    if (primerPasoFallido) {
      label = `Falló en el paso ${primerPasoFallido.numero}`
    }
  }

  const tone = estadoTone(estado, 'ejecucion')
  return (
    <StatusBadge
      tone={tone}
      className={tone === 'neutral' ? 'border border-m3-outline-variant' : undefined}
    >
      {label}
    </StatusBadge>
  )
}
