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
    case 'paso': return 'bg-green-50 text-green-700 border-green-200'
    case 'fallo': return 'bg-red-50 text-red-700 border-red-200'
    case 'reparado': return 'bg-amber-50 text-amber-700 border-amber-200'
    default: return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export function PasoAccordionItem({ paso, expanded, onToggle }: Props) {
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
    <div className="border-b border-gray-100 last:border-b-0" data-purpose="step-container">
      {/* Header */}
      <button
        type="button"
        role="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className={`group w-full text-left cursor-pointer transition-colors px-6 py-4 flex items-start gap-4 ${
          paso.estado === 'fallo' ? 'bg-red-50/20 hover:bg-red-50/50' : 'bg-white hover:bg-gray-50'
        }`}
        data-purpose="step-row"
      >
        <div className="text-sm font-medium text-gray-500 mono pt-1 w-8">
          {paso.numero.toString().padStart(2, '0')}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-gray-900 font-medium mb-1">{paso.descripcion}</h4>
          {paso.errorMsg && (
            <p className="text-xs text-red-600 mono">{paso.errorMsg}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClasses(paso.estado)}`}>
            {statusLabel(paso.estado)}
          </span>
          <span className="text-xs text-gray-400 mono">{formatDuration(paso.duracionMs)}</span>
        </div>
      </button>

      {/* Panel */}
      {expanded && (
        <div id={panelId} className="bg-[#fafafa] px-6 py-6 shadow-inner border-y border-gray-200">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-6">
            {/* Left: Detalles Técnicos */}
            <div>
              <h5 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wider">Detalles Técnicos</h5>
              <div className="space-y-4">
                {paso.resultadoEsperado && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">Resultado esperado</p>
                    <p className="text-sm text-gray-700 bg-white p-3 border border-gray-200 rounded-md">{paso.resultadoEsperado}</p>
                  </div>
                )}
                {paso.resultadoObtenido && (
                  <div>
                    <p className="text-[11px] font-semibold text-gray-500 uppercase mb-1">Resultado obtenido</p>
                    <p className={`text-sm p-3 border rounded-md font-medium ${
                      paso.estado === 'fallo' ? 'text-red-700 bg-red-50 border-red-100' : 'text-green-700 bg-green-50 border-green-100'
                    }`}>
                      {paso.resultadoObtenido}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Logs & Trace */}
            <div>
              <h5 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wider">Logs & Trace</h5>
              <div className="space-y-4">
                {logs.length > 0 ? (
                  <pre className="bg-gray-900 text-gray-300 p-3 rounded-md text-xs mono overflow-x-auto border border-gray-800">
                    {logs.map((log, i) => (
                      <div key={i}>[{log.ts}] {log.level.toUpperCase()}: {log.msg}</div>
                    ))}
                  </pre>
                ) : (
                  <p className="text-sm text-gray-400 italic">Sin logs registrados.</p>
                )}
              </div>
            </div>
          </div>

          {/* Captures */}
          {(paso.subacciones ?? []).some((s) => s.capturaActual || s.capturaReferencia) && (
            <div>
              <h5 className="text-xs font-bold text-gray-800 mb-3 uppercase tracking-wider">Capturas de evidencia</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {paso.subacciones.map((sub) => (
                  <div key={sub.id} className="space-y-4">
                    {sub.capturaActual && (
                      <div className="group/img relative">
                        <p className="mb-2 text-xs font-medium text-red-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          Captura actual (Error)
                        </p>
                        <SafeArtefactoImage
                          src={`/api/artefactos/${sub.capturaActual.id}`}
                          alt="Captura actual del error"
                          borderClass="border border-red-200"
                        />
                      </div>
                    )}
                    {sub.capturaReferencia && (
                      <div className="group/img relative">
                        <p className="mb-2 text-xs font-medium text-green-700 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-600" />
                          Referencia esperada (Éxito)
                        </p>
                        <SafeArtefactoImage
                          src={`/api/artefactos/${sub.capturaReferencia.id}`}
                          alt="Referencia esperada"
                          borderClass="border border-green-200"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
