'use client'

import { useCallback } from 'react'
import { PasoSubaccionItem } from './paso-subaccion-item'

interface Subaccion {
  id: string
  numero: number
  descripcion: string
  estado: string
  duracionMs: number | null
  tipo: string
  errorMsg: string | null
  logs: unknown
  capturaActual?: { id: string; tipo: string; nombre: string; bytes: number } | null
  capturaReferencia?: { id: string; tipo: string; nombre: string; bytes: number } | null
}

interface Paso {
  id: string
  numero: number
  descripcion: string
  estado: string
  duracionMs: number | null
  selfHealed: boolean
  errorMsg: string | null
  resultadoEsperado: string | null
  resultadoObtenido: string | null
  errorCount: number
  logs: unknown
  createdAt: string
  subacciones: Subaccion[]
}

interface Props {
  paso: Paso
  expanded: boolean
  onToggle: () => void
  expandedSubaccionId?: string | null
  onToggleSubaccion?: (id: string) => void
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

function statusLabel(estado: string): string {
  switch (estado) {
    case 'paso': return 'Conforme'
    case 'fallo': return 'No conforme'
    case 'reparado': return 'Reparado'
    default: return estado
  }
}

function statusClasses(estado: string): string {
  switch (estado) {
    case 'paso': return 'bg-m3-tertiary-container/15 text-m3-on-tertiary-container border-m3-tertiary-container/40'
    case 'fallo': return 'bg-m3-error-container/15 text-m3-error border-m3-error/30'
    case 'reparado': return 'bg-m3-secondary-container/40 text-m3-on-secondary-container border-m3-secondary/30'
    default: return 'bg-m3-surface-container text-m3-on-surface-variant border-m3-outline-variant'
  }
}

export function PasoAccordionItem({ paso, expanded, onToggle, expandedSubaccionId, onToggleSubaccion }: Props) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }, [onToggle])

  const panelId = `panel-${paso.id}`

  const logs: Array<{ ts: string; level: string; msg: string; source: string }> =
    Array.isArray(paso.logs) ? paso.logs : []

  return (
    <div className="border-b border-m3-outline-variant last:border-b-0" data-purpose="step-container">
      {/* Header */}
      <button
        type="button"
        role="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className={`group w-full text-left cursor-pointer transition-colors px-6 py-4 flex items-start gap-4 ${
          paso.estado === 'fallo' ? 'bg-m3-error-container/5 hover:bg-m3-error-container/10' : 'bg-m3-surface-container-lowest hover:bg-m3-surface-container-high'
        }`}
        data-purpose="step-row"
      >
        <div className="text-sm font-medium text-m3-on-surface-variant mono pt-1 w-8">
          {paso.numero.toString().padStart(2, '0')}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-m3-on-surface font-medium mb-1">{paso.descripcion}</h4>
          {paso.errorMsg && (
            <p className="text-xs text-m3-error mono">{paso.errorMsg}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClasses(paso.estado)}`}>
            {statusLabel(paso.estado)}
          </span>
          <span className="text-xs text-m3-on-surface-variant/70 mono">{formatDuration(paso.duracionMs)}</span>
        </div>
      </button>

      {/* Panel */}
      {expanded && (
        <div id={panelId} className="bg-m3-surface-container px-6 py-6 shadow-inner border-y border-m3-outline-variant">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-6">
            {/* Left: Detalles Técnicos */}
            <div>
              <h5 className="text-xs font-bold text-m3-on-surface mb-3 uppercase tracking-wider">Detalles Técnicos</h5>
              <div className="space-y-4">
                {paso.resultadoEsperado && (
                  <div>
                    <p className="text-[11px] font-semibold text-m3-on-surface-variant uppercase mb-1">Resultado esperado</p>
                    <p className="text-sm text-m3-on-surface-variant bg-m3-surface-container-lowest p-3 border border-m3-outline-variant rounded-md">{paso.resultadoEsperado}</p>
                  </div>
                )}
                {paso.resultadoObtenido && (
                  <div>
                    <p className="text-[11px] font-semibold text-m3-on-surface-variant uppercase mb-1">Resultado obtenido</p>
                    <p className={`text-sm p-3 border rounded-md font-medium ${
                      paso.estado === 'fallo' ? 'text-m3-error bg-m3-error-container/15 border-m3-error/20' : 'text-m3-on-tertiary-container bg-m3-tertiary-container/15 border-m3-tertiary-container/30'
                    }`}>
                      {paso.resultadoObtenido}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Logs & Trace */}
            <div>
              <h5 className="text-xs font-bold text-m3-on-surface mb-3 uppercase tracking-wider">Logs & Trace</h5>
              <div className="space-y-4">
                {logs.length > 0 ? (
                  <pre className="bg-m3-inverse-surface text-m3-inverse-on-surface p-3 rounded-md text-xs mono overflow-x-auto border border-m3-outline">
                    {logs.map((log, i) => (
                      <div key={i}>[{log.ts}] {log.level.toUpperCase()}: {log.msg}</div>
                    ))}
                  </pre>
                ) : (
                  <p className="text-sm text-m3-on-surface-variant/70 italic">Sin logs registrados.</p>
                )}
              </div>
            </div>
          </div>

          {/* Sub-pasos (dentro del panel) */}
          {(paso.subacciones ?? []).length > 0 && (
            <div className="mt-6 pt-6 border-t border-m3-outline-variant">
              <h5 className="text-xs font-bold text-m3-on-surface mb-3 uppercase tracking-wider">
                Sub-pasos ({paso.subacciones.length})
              </h5>
              <div className="space-y-2">
                {paso.subacciones.map((sub) => (
                  <PasoSubaccionItem
                    key={sub.id}
                    subaccion={sub}
                    expanded={expandedSubaccionId === sub.id}
                    onToggle={() => onToggleSubaccion?.(sub.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
