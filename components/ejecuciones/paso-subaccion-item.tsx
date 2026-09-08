'use client'

import { Camera } from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'

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

interface Props {
  subaccion: Subaccion
  expanded: boolean
  onToggle: () => void
  isNew?: boolean
}

function SafeArtefactoImage({ src, alt, borderClass }: { src: string; alt: string; borderClass: string }) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  // Reset error and loading states when src changes
  useEffect(() => {
    setError(false)
    setLoading(true)
  }, [src])

  return (
    <div className={`aspect-video bg-m3-surface-container-high rounded-lg ${borderClass} overflow-hidden shadow-sm relative`}>
      {error ? (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-xs text-m3-on-surface-variant">Evidencia no disponible</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`object-cover w-full h-full ${loading ? 'hidden' : ''}`}
          onLoad={() => setLoading(false)}
          onError={() => {
            setError(true)
            setLoading(false)
          }}
        />
      )}
    </div>
  )
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

export function PasoSubaccionItem({ subaccion, expanded, onToggle, isNew }: Props) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }, [onToggle])

  const panelId = `subpanel-${subaccion.id}`
  const hasCapturas = subaccion.capturaActual || subaccion.capturaReferencia

  if (hasCapturas) {
    return (
      <div
        data-testid="subaccion-item"
        className={`border border-m3-outline-variant rounded-md overflow-hidden ${isNew ? 'new' : ''}`}
      >
        <button
          type="button"
          role="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          onKeyDown={handleKeyDown}
          className="w-full text-left px-4 py-3 flex items-center gap-3 bg-m3-surface-container-lowest hover:bg-m3-surface-container-high transition-colors"
        >
          <Camera className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span className="text-xs font-medium text-m3-on-surface-variant/70 mono w-5">
            {subaccion.numero}
          </span>
          <span className="text-sm text-m3-on-surface-variant flex-1 truncate">
            {subaccion.descripcion}
          </span>
          {subaccion.errorMsg && (
            <span className="text-xs text-m3-error truncate max-w-[200px]">{subaccion.errorMsg}</span>
          )}
          <span className="text-[10px] uppercase tracking-wider text-m3-on-surface-variant/70 border border-m3-outline-variant px-1.5 py-0.5 rounded">
            {subaccion.tipo}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusClasses(subaccion.estado)}`}>
            {statusLabel(subaccion.estado)}
          </span>
          <span className="text-xs text-m3-on-surface-variant/70 mono">{formatDuration(subaccion.duracionMs)}</span>
        </button>

        {expanded && (
          <div id={panelId} className="px-4 py-4 bg-m3-surface-container border-t border-m3-outline-variant">
            {(subaccion.capturaActual || subaccion.capturaReferencia) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {subaccion.capturaActual && (
                  <div className="relative">
                    <p className="mb-1 text-xs font-medium text-m3-error flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-m3-error" />
                      Captura actual
                    </p>
                    <SafeArtefactoImage
                      src={`/api/artefactos/${subaccion.capturaActual.id}`}
                      alt="Captura actual del error"
                      borderClass="border border-m3-error/30"
                    />
                  </div>
                )}
                {subaccion.capturaReferencia && (
                  <div className="relative">
                    <p className="mb-1 text-xs font-medium text-m3-on-tertiary-container flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-m3-on-tertiary-container" />
                      Referencia esperada
                    </p>
                    <SafeArtefactoImage
                      src={`/api/artefactos/${subaccion.capturaReferencia.id}`}
                      alt="Referencia esperada"
                      borderClass="border border-m3-tertiary-container/40"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid="subaccion-item"
      className={`border border-m3-outline-variant rounded-md px-4 py-3 flex items-center gap-3 bg-m3-surface-container opacity-60 ${isNew ? 'new' : ''}`}
    >
      <span className="text-xs font-medium text-m3-on-surface-variant/70 mono w-5">
        {subaccion.numero}
      </span>
      <span className="text-sm text-m3-on-surface-variant flex-1 truncate">
        {subaccion.descripcion}
      </span>
      {subaccion.errorMsg && (
        <span className="text-xs text-m3-error truncate max-w-[200px]">{subaccion.errorMsg}</span>
      )}
      <span className="text-[10px] uppercase tracking-wider text-m3-on-surface-variant/70 border border-m3-outline-variant px-1.5 py-0.5 rounded">
        {subaccion.tipo}
      </span>
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusClasses(subaccion.estado)}`}>
        {statusLabel(subaccion.estado)}
      </span>
      <span className="text-xs text-m3-on-surface-variant/70 mono">{formatDuration(subaccion.duracionMs)}</span>
    </div>
  )
}
