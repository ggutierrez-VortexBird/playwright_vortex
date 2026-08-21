'use client'

import { useCallback, useState } from 'react'

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
  return (
    <div className={`aspect-video bg-gray-100 rounded-lg ${borderClass} overflow-hidden shadow-sm relative`}>
      {error ? (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-xs text-gray-500">Evidencia no disponible</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="object-cover w-full h-full"
          onError={() => setError(true)}
        />
      )}
    </div>
  )
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  return `${(ms / 1000).toFixed(1)}s`
}

export function PasoSubaccionItem({ subaccion, expanded, onToggle, isNew }: Props) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle()
    }
  }, [onToggle])

  const panelId = `subpanel-${subaccion.id}`

  const logs: Array<{ ts: string; level: string; msg: string; source: string }> =
    Array.isArray(subaccion.logs) ? subaccion.logs : []

  return (
    <div
      data-testid="subaccion-item"
      className={`border border-gray-200 rounded-md overflow-hidden ${isNew ? 'new' : ''}`}
    >
      <button
        type="button"
        role="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className="w-full text-left px-4 py-3 flex items-center gap-3 bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-xs font-medium text-gray-400 mono w-5">
          {subaccion.numero}
        </span>
        <span className="text-sm text-gray-700 flex-1 truncate">
          {subaccion.descripcion}
        </span>
        {subaccion.errorMsg && (
          <span className="text-xs text-red-600 truncate max-w-[200px]">{subaccion.errorMsg}</span>
        )}
        <span className="text-[10px] uppercase tracking-wider text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">
          {subaccion.tipo}
        </span>
        <span className="text-xs text-gray-400 mono">{formatDuration(subaccion.duracionMs)}</span>
      </button>

      {expanded && (
        <div id={panelId} className="px-4 py-4 bg-gray-50 border-t border-gray-100 space-y-4">
          {logs.length > 0 && (
            <pre className="bg-gray-900 text-gray-300 p-3 rounded-md text-xs mono overflow-x-auto border border-gray-800 max-h-[200px] overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i}>[{log.ts}] {log.level.toUpperCase()}: {log.msg}</div>
              ))}
            </pre>
          )}

          {(subaccion.capturaActual || subaccion.capturaReferencia) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subaccion.capturaActual && (
                <div className="relative">
                  <p className="mb-1 text-xs font-medium text-red-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                    Captura actual
                  </p>
                  <SafeArtefactoImage
                    src={`/api/artefactos/${subaccion.capturaActual.id}`}
                    alt="Captura actual del error"
                    borderClass="border border-red-200"
                  />
                </div>
              )}
              {subaccion.capturaReferencia && (
                <div className="relative">
                  <p className="mb-1 text-xs font-medium text-green-700 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                    Referencia esperada
                  </p>
                  <SafeArtefactoImage
                    src={`/api/artefactos/${subaccion.capturaReferencia.id}`}
                    alt="Referencia esperada"
                    borderClass="border border-green-200"
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
