'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PasoAccordionList } from './paso-accordion-list'
import { EntornoDetails } from './entorno-details'
import { AsercionesResumen } from './aserciones-resumen'
import { ErrorMotorBadge } from './error-motor-badge'
import { EjecucionStatus } from './ejecucion-status'
import { EjecucionSummary } from './ejecucion-summary'
import { DetenerButton } from './detener-button'
import { ReRunButton } from './re-run-button'
import { OrigenChip } from './origen-chip'
import { ReparadosCounter } from './reparados-counter'

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

interface CasoPrueba {
  nombre: string
  codigo: string
  // HU-G17: origen del caso (subirScript | grabador | mixto)
  origen?: string | null
}

interface Artefacto {
  id: string
  tipo: string
  nombre: string
  pasoEjecucionId: string | null
  bytes: number
  createdAt: string
}

interface Ejecucion {
  id: string
  estado: string
  inicioAt: string | null
  finAt: string | null
  duracionMs: number | null
  errorMsg: string | null
  entorno: string | null
  navegador: string | null
  sistemaOperativo: string | null
  nodoEjecucion: string | null
  asercionesTotal: number
  asercionesOk: number
  asercionesFail: number
  casoPruebaId: string
  casoPrueba: CasoPrueba
  pasos: Paso[]
  artefactos: Artefacto[]
}

interface Props {
  ejecucionId: string
  initialEjecucion: Ejecucion
}

export function EjecucionDetalleClient({ ejecucionId, initialEjecucion }: Props) {
  const [ejecucion, setEjecucion] = useState<Ejecucion>(initialEjecucion)
  const expandedPasoIdRef = useRef<string | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}`)
      if (!res.ok) return
      const data: Ejecucion = await res.json()

      // Preserve expanded paso if it still exists in new data
      const ids = new Set(data.pasos.map((p) => p.id))
      if (expandedPasoIdRef.current && !ids.has(expandedPasoIdRef.current)) {
        expandedPasoIdRef.current = data.pasos[0]?.id ?? null
      }

      setEjecucion(data)
    } catch {
      // ignore polling errors
    }
  }, [ejecucionId])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [poll])

  const caso = ejecucion.casoPrueba
  const isRunning = ejecucion.estado === 'corriendo'
  const canReRun = ['paso', 'fallo', 'reparado', 'errorMotor', 'cancelado'].includes(
    ejecucion.estado
  )

  const videoArtefacto = ejecucion.artefactos.find((a) => a.tipo === 'video')
  const totalDuracionMs = ejecucion.pasos.reduce((sum, p) => sum + (p.duracionMs ?? 0), 0)

  const handleExpandedChange = useCallback((pasoId: string | null) => {
    expandedPasoIdRef.current = pasoId
  }, [])

  return (
    <div className="flex flex-col gap-6 accordion-panel">
      {/* Topbar */}
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Ejecución {ejecucionId.slice(0, 8)}</h2>
        <span className="sub">
          {caso.nombre} · {caso.codigo} ·{' '}
          {ejecucion.inicioAt
            ? new Date(ejecucion.inicioAt).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </span>
        {/* HU-G17: chip de origen (grabador vs. script) */}
        {caso.origen && <OrigenChip origen={caso.origen} />}
        {/* HU-G15 — contador de pasos auto-reparados en ejecución */}
        <ReparadosCounter pasos={ejecucion.pasos} />
        <span className="spacer" />
        {canReRun && (
          <ReRunButton casoPruebaId={ejecucion.casoPruebaId} />
        )}
        {isRunning ? (
          <span className="stamp">
            <span className="ink" aria-hidden="true" />
            Corriendo
          </span>
        ) : (
          <EjecucionStatus estado={ejecucion.estado} pasos={ejecucion.pasos} />
        )}
        <DetenerButton
          ejecucionId={ejecucion.id}
          visible={
            ejecucion.estado === 'pendiente' || ejecucion.estado === 'corriendo'
          }
        />
        {ejecucion.estado === 'errorMotor' && (
          <ErrorMotorBadge message={ejecucion.errorMsg ?? ''} />
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Summary Card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden" data-purpose="summary-header">
            <EjecucionSummary
              estado={ejecucion.estado}
              duracionMs={ejecucion.duracionMs}
              inicioAt={ejecucion.inicioAt ? new Date(ejecucion.inicioAt) : null}
              finAt={ejecucion.finAt ? new Date(ejecucion.finAt) : null}
              errorMsg={ejecucion.errorMsg}
              pasos={ejecucion.pasos}
            />
          </div>

          {/* Steps accordion */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col flex-grow" data-purpose="test-steps-section">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center rounded-t-lg">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pasos ejecutados</h3>
              <span className="text-xs font-semibold text-gray-500">{ejecucion.pasos.length}</span>
            </div>
            <div className="flex flex-col flex-grow overflow-y-auto steps-scroll max-h-[800px]" data-purpose="steps-list">
              <PasoAccordionList
                pasos={ejecucion.pasos}
                defaultExpandedId={expandedPasoIdRef.current}
                onExpandedChange={handleExpandedChange}
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-[90px] self-start w-full">
          {/* Video */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Video de la ejecución</h3>
            {isRunning && ejecucion.artefactos.length === 0 ? (
              <div className="video" data-testid="generando-evidencia">
                <div className="ann">En curso</div>
                <div className="flex items-center justify-center text-white/70 text-sm">
                  Generando evidencia
                </div>
              </div>
            ) : videoArtefacto ? (
              <div className="video">
                <div className="ann">
                  {ejecucion.estado === 'fallo' ? 'Fallo · verificación' : 'Paso destacado'}
                </div>
                <video
                  data-testid="video-player"
                  src={`/api/artefactos/${videoArtefacto.id}`}
                  controls
                  className="w-full h-full object-contain"
                />
                {totalDuracionMs > 0 && (
                  <div className="bar">
                    {ejecucion.pasos.map((p) => (
                      <i
                        key={p.id}
                        data-testid="chapter-bar"
                        className={`chapter ${p.estado === 'fallo' ? 'done' : ''}`}
                        style={{
                          width: `${Math.round(((p.duracionMs ?? 0) / totalDuracionMs) * 100)}%`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="video">
                <div className="ann">
                  {ejecucion.estado === 'fallo' ? 'Fallo · verificación' : 'Sin video'}
                </div>
                <div className="flex items-center justify-center text-white/70 text-sm">
                  No hay video disponible
                </div>
              </div>
            )}
          </div>

          {/* Environment + Assertions card */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 rounded-t-lg">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Detalles de entorno</h3>
            </div>
            <div className="p-6">
              <EntornoDetails
                entorno={ejecucion.entorno}
                navegador={ejecucion.navegador}
                sistemaOperativo={ejecucion.sistemaOperativo}
                nodoEjecucion={ejecucion.nodoEjecucion}
              />
              <div className="mt-6 pt-6 border-t border-gray-100">
                <dt className="text-[11px] font-semibold text-gray-500 uppercase mb-3">Resumen de Aserciones</dt>
                <AsercionesResumen
                  total={ejecucion.asercionesTotal}
                  ok={ejecucion.asercionesOk}
                  fail={ejecucion.asercionesFail}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="note">
        <b>Cómo leer esta pantalla:</b> a la izquierda, el acta paso a paso con
        detalle expandible. A la derecha, el video de la ejecución y los detalles
        de entorno con resumen de aserciones.
      </div>
    </div>
  )
}
