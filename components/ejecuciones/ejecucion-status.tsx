interface Paso {
  id: string
  numero: number
  estado: string
}

interface EjecucionStatusProps {
  estado: string
  pasos?: Paso[]
}

// Paridad exacta con los badges .b-paso/.b-fallo/.b-corriendo/.b-pendiente/
// .b-reparado de documentacion/referencias-diseño/mockup-propuesta.html.
const ESTADO_MAP: Record<string, { label: string; className: string }> = {
  pendiente: {
    label: 'Pendiente',
    className: 'bg-m3-info-container text-m3-info',
  },
  corriendo: {
    label: 'Corriendo',
    className: 'bg-m3-warn-container text-m3-secondary',
  },
  paso: {
    label: 'Pasó',
    className: 'bg-m3-success-container text-m3-success',
  },
  fallo: {
    label: 'Falló',
    className: 'bg-m3-danger-container text-m3-error',
  },
  reparado: {
    label: 'Reparado',
    className: 'bg-m3-reparado-container text-m3-reparado',
  },
  errorMotor: {
    label: 'Error motor',
    className: 'bg-m3-danger-container text-m3-error',
  },
}

export function EjecucionStatus({ estado, pasos }: EjecucionStatusProps) {
  const cfg =
    ESTADO_MAP[estado] ?? {
      label: estado,
      className:
        'bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant',
    }

  let label = cfg.label
  if (estado === 'fallo' && pasos) {
    const primerPasoFallido = pasos.find(p => p.estado === 'fallo')
    if (primerPasoFallido) {
      label = `Falló en el paso ${primerPasoFallido.numero}`
    }
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label text-label-sm font-medium ${cfg.className}`}
    >
      {label}
    </span>
  )
}
