interface Paso {
  id: string
  numero: number
  estado: string
}

interface EjecucionStatusProps {
  estado: string
  pasos?: Paso[]
}

const ESTADO_MAP: Record<
  string,
  { label: string; variant: 'p-pass' | 'p-fail' | 'p-heal' | 'p-idle' | 'p-running' }
> = {
  pendiente: { label: 'Pendiente', variant: 'p-idle' },
  corriendo: { label: 'Corriendo', variant: 'p-running' },
  paso: { label: 'Pasó', variant: 'p-pass' },
  fallo: { label: 'Falló', variant: 'p-fail' },
  reparado: { label: 'Reparado', variant: 'p-heal' },
  errorMotor: { label: 'Error motor', variant: 'p-idle' },
}

export function EjecucionStatus({ estado, pasos }: EjecucionStatusProps) {
  const cfg =
    ESTADO_MAP[estado] ?? { label: estado, variant: 'p-idle' as const }

  let label = cfg.label
  if (estado === 'fallo' && pasos) {
    const primerPasoFallido = pasos.find(p => p.estado === 'fallo')
    if (primerPasoFallido) {
      label = `Falló en el paso ${primerPasoFallido.numero}`
    }
  }

  return <span className={`pill ${cfg.variant}`}>{label}</span>
}
