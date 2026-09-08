interface Paso {
  id: string
  numero: number
  estado: string
}

interface EjecucionStatusProps {
  estado: string
  pasos?: Paso[]
}

const ESTADO_MAP: Record<string, { label: string; className: string }> = {
  pendiente: {
    label: 'Pendiente',
    className:
      'bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant',
  },
  corriendo: {
    label: 'Corriendo',
    className:
      'bg-m3-secondary-container/25 text-m3-on-secondary-container border border-m3-secondary/30',
  },
  paso: {
    label: 'Pasó',
    className:
      'bg-m3-tertiary-container/15 text-m3-on-tertiary-container border border-m3-tertiary-container/40',
  },
  fallo: {
    label: 'Falló',
    className: 'bg-m3-error-container/60 text-m3-error border border-m3-error/25',
  },
  reparado: {
    label: 'Reparado',
    className:
      'bg-m3-secondary-container/25 text-m3-on-secondary-container border border-m3-secondary/30',
  },
  errorMotor: {
    label: 'Error motor',
    className: 'bg-m3-error-container/60 text-m3-error border border-m3-error/25',
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
