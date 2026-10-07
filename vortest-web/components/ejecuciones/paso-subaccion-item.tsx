'use client'

import { Camera } from 'lucide-react'
import { useCallback } from 'react'
import { EstadoBadge } from '@/components/ui/status-badge'
import { formatDuration } from '@/lib/format'
import { VisorEvidencia } from './visor-evidencia'

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
  return <VisorEvidencia src={src} alt={alt} titulo={alt} className={borderClass} />
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
          <Camera className="w-4 h-4 text-m3-info flex-shrink-0" />
          <span className="text-xs font-medium text-m3-on-surface-variant mono w-5">
            {subaccion.numero}
          </span>
          <span className="text-sm text-m3-on-surface-variant flex-1 truncate">
            {subaccion.descripcion}
          </span>
          {subaccion.errorMsg && (
            <span className="text-xs text-m3-error truncate max-w-[200px]">{subaccion.errorMsg}</span>
          )}
          <span className="text-label-xs uppercase tracking-wider text-m3-on-surface-variant border border-m3-outline-variant px-1.5 py-0.5 rounded">
            {subaccion.tipo}
          </span>
          <EstadoBadge estado={subaccion.estado} contexto="paso" className="text-label-xs" />
          <span className="text-xs text-m3-on-surface-variant mono">{formatDuration(subaccion.duracionMs, { soloSegundos: true })}</span>
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
      <span className="text-xs font-medium text-m3-on-surface-variant mono w-5">
        {subaccion.numero}
      </span>
      <span className="text-sm text-m3-on-surface-variant flex-1 truncate">
        {subaccion.descripcion}
      </span>
      {subaccion.errorMsg && (
        <span className="text-xs text-m3-error truncate max-w-[200px]">{subaccion.errorMsg}</span>
      )}
      <span className="text-label-xs uppercase tracking-wider text-m3-on-surface-variant border border-m3-outline-variant px-1.5 py-0.5 rounded">
        {subaccion.tipo}
      </span>
      <EstadoBadge estado={subaccion.estado} contexto="paso" className="text-label-xs" />
      <span className="text-xs text-m3-on-surface-variant mono">{formatDuration(subaccion.duracionMs, { soloSegundos: true })}</span>
    </div>
  )
}
