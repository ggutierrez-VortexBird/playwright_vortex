/**
 * DUP-02 — Mapa único estado → etiqueta / tono para ejecuciones y pasos.
 * Todo el vocabulario es "Conforme / No conforme" (sin "Reparado").
 */
import type { StatusBadgeTone } from '@/components/ui/status-badge'

export type EstadoContexto = 'ejecucion' | 'paso'

export const ESTADO_LABEL: Record<EstadoContexto, Record<string, string>> = {
  ejecucion: {
    pendiente: 'Pendiente',
    corriendo: 'Corriendo',
    paso: 'Pasó',
    fallo: 'Falló',
    errorMotor: 'Error motor',
    cancelado: 'Cancelado',
  },
  paso: {
    paso: 'Conforme',
    fallo: 'No conforme',
  },
}

export const ESTADO_TONE: Record<EstadoContexto, Record<string, StatusBadgeTone>> = {
  ejecucion: {
    pendiente: 'info',
    corriendo: 'warning',
    paso: 'success',
    fallo: 'error',
    errorMotor: 'error',
    cancelado: 'neutral',
  },
  paso: {
    paso: 'success',
    fallo: 'error',
  },
}

export function estadoLabel(estado: string, contexto: EstadoContexto = 'ejecucion'): string {
  return ESTADO_LABEL[contexto][estado] ?? estado
}

export function estadoTone(estado: string, contexto: EstadoContexto = 'ejecucion'): StatusBadgeTone {
  return ESTADO_TONE[contexto][estado] ?? 'neutral'
}
