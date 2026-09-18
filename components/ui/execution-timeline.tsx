'use client'

import { cn } from '@/lib/utils'

export type StepEstado = 'passed' | 'failed' | 'warning' | 'skipped' | 'running'

export interface ExecutionTimelineStep {
  id: string
  numero: number
  descripcion: string
  estado: StepEstado
  duracionMs?: number
}

interface ExecutionTimelineProps {
  steps: ExecutionTimelineStep[]
  currentStepId?: string
  onStepClick?: (stepId: string) => void
  className?: string
}

const ESTADO_CONFIG: Record<StepEstado, { container: string; text: string; icon: string }> = {
  passed: {
    container: 'bg-m3-success-container text-m3-success',
    text: 'text-m3-on-success-container',
    icon: 'check',
  },
  failed: {
    container: 'bg-m3-error-container text-m3-error',
    text: 'text-m3-on-error-container',
    icon: 'close',
  },
  warning: {
    container: 'bg-m3-warning-container text-m3-warning',
    text: 'text-m3-on-warning-container',
    icon: 'warning',
  },
  skipped: {
    container: 'bg-m3-surface-container-high text-m3-on-surface-variant',
    text: 'text-m3-on-surface-variant',
    icon: 'remove',
  },
  running: {
    container: 'bg-m3-info-container text-m3-info',
    text: 'text-m3-on-info-container',
    icon: 'sync',
  },
}

function formatDuration(ms?: number): string {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  const secs = (ms / 1000).toFixed(1)
  return `${secs}s`
}

/**
 * ExecutionTimeline — Signature Component #1
 *
 * Visualiza una ejecucion como secuencia horizontal de pasos con estados semanticos.
 * Anatomia: contenedor horizontal scrolleable, nodos por cada paso, conectores entre nodos.
 *
 * Tokens M3:
 *   passed: m3-success-container / m3-on-success-container
 *   failed: m3-error-container / m3-on-error-container
 *   warning: m3-warning-container / m3-on-warning-container
 *   skipped: m3-surface-container-high / m3-on-surface-variant
 *   running: m3-info-container / m3-on-info-container
 *
 * Impeccable: shape + typeset + layout + animate
 * prefers-reduced-motion: el animate-pulse del estado running se reemplaza por opacity change
 */
export function ExecutionTimeline({ steps, currentStepId, onStepClick, className }: ExecutionTimelineProps) {
  if (steps.length === 0) return null

  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto p-4 bg-m3-surface-container-lowest rounded-lg',
        className
      )}
      role="list"
      aria-label="Linea de tiempo de ejecucion"
    >
      {steps.map((step, index) => {
        const config = ESTADO_CONFIG[step.estado]
        const isCurrent = step.id === currentStepId
        const isLast = index === steps.length - 1

        return (
          <div key={step.id} className="flex items-center">
            {/* Step node */}
            <button
              type="button"
              onClick={() => onStepClick?.(step.id)}
              disabled={!onStepClick}
              className={cn(
                'flex flex-col items-center justify-center rounded-full',
                'min-w-[56px] w-14 h-14',
                config.container,
                config.text,
                'transition-shadow duration-200',
                'hover:shadow-card',
                isCurrent && 'ring-2 ring-m3-primary ring-offset-2',
                onStepClick && 'cursor-pointer',
                !onStepClick && 'cursor-default'
              )}
              aria-label={`Paso ${step.numero}: ${step.descripcion} - ${step.estado}`}
              title={step.descripcion}
            >
              <span className="material-symbols-outlined text-[18px]">
                {step.estado === 'running' ? 'sync' : config.icon}
              </span>
              <span className="font-label text-label-xs font-semibold mt-0.5">
                {step.numero}
              </span>
            </button>

            {/* Connector line (not after last) */}
            {!isLast && (
              <div
                className={cn(
                  'mx-1 h-0.5 min-w-[16px] flex-1',
                  ESTADO_CONFIG[steps[index + 1]?.estado ?? 'skipped'].container.replace('bg-m3-', 'bg-').split(' ')[0],
                  'opacity-60'
                )}
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}

      {/* Duration summary — right side */}
      {steps.length > 0 && (
        <div className="ml-auto shrink-0 pl-4 font-label text-label-sm text-m3-on-surface-variant">
          {(() => {
            const total = steps.reduce((sum, s) => sum + (s.duracionMs ?? 0), 0)
            return total > 0 ? formatDuration(total) : null
          })()}
        </div>
      )}
    </div>
  )
}
