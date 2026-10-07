import { EstadoBadge } from '@/components/ui/status-badge'

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
  const primerPasoFallido = pasos?.find(p => p.estado === 'fallo')?.numero
  return <EstadoBadge estado={estado} primerPasoFallido={primerPasoFallido} />
}
