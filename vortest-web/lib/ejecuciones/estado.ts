/**
 * Mapa único estado → etiqueta, tono e ícono para ejecuciones, pasos y casos.
 * Vocabulario del dominio: "Conforme / No conforme".
 */
import type { StatusBadgeTone } from '@/components/ui/status-badge'

export type EstadoContexto = 'ejecucion' | 'paso'

interface EstadoVisual {
  label: string
  tone: StatusBadgeTone
  icon: string
}

const EJECUCION: Record<string, EstadoVisual> = {
  pendiente: { label: 'En cola', tone: 'info', icon: 'schedule' },
  corriendo: { label: 'Ejecutando', tone: 'info', icon: 'progress_activity' },
  paso: { label: 'Conforme', tone: 'success', icon: 'check_circle' },
  fallo: { label: 'No conforme', tone: 'error', icon: 'cancel' },
  errorMotor: { label: 'Error del motor', tone: 'warning', icon: 'report' },
  cancelado: { label: 'Cancelada', tone: 'neutral', icon: 'block' },
  'sin ejecuciones': { label: 'Sin ejecutar', tone: 'neutral', icon: 'radio_button_unchecked' },
}

const PASO: Record<string, EstadoVisual> = {
  paso: { label: 'Conforme', tone: 'success', icon: 'check_circle' },
  fallo: { label: 'No conforme', tone: 'error', icon: 'cancel' },
  pendiente: { label: 'Pendiente', tone: 'neutral', icon: 'radio_button_unchecked' },
  corriendo: { label: 'Ejecutando', tone: 'info', icon: 'progress_activity' },
}

const MAPAS: Record<EstadoContexto, Record<string, EstadoVisual>> = { ejecucion: EJECUCION, paso: PASO }

export const ESTADOS_EN_CURSO = ['pendiente', 'corriendo'] as const

export function estadoVisual(estado: string, contexto: EstadoContexto = 'ejecucion'): EstadoVisual {
  return MAPAS[contexto][estado] ?? { label: estado, tone: 'neutral', icon: 'help' }
}

export function estadoLabel(estado: string, contexto: EstadoContexto = 'ejecucion'): string {
  return estadoVisual(estado, contexto).label
}

export function estadoTone(estado: string, contexto: EstadoContexto = 'ejecucion'): StatusBadgeTone {
  return estadoVisual(estado, contexto).tone
}

/** "No conforme · paso 3" cuando se conoce el primer paso que falló. */
export function resultadoEjecucionLabel(estado: string, primerPasoFallido?: number | null): string {
  const base = estadoLabel(estado, 'ejecucion')
  return estado === 'fallo' && primerPasoFallido != null ? `${base} · paso ${primerPasoFallido}` : base
}

export function estaEnCurso(estado: string): boolean {
  return (ESTADOS_EN_CURSO as readonly string[]).includes(estado)
}
