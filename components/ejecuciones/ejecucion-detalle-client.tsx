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
import { VideoChapterBar } from './video-chapter-bar'
import { GenerarActaButton } from './generar-acta-button'

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
  // HU-G18 — chapter timestamps del video.
  videoInicioMs: number | null
  videoFinMs: number | null
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
  // HU-G19 — acta ya generada (si existe).
  acta?: { id: string; consecutivo: string; rutaPdf: string } | null
}

interface Props {
  ejecucionId: string
  initialEjecucion: Ejecucion
}

export function EjecucionDetalleClient({ ejecucionId, initialEjecucion }: Props) {
  const [ejecucion, setEjecucion] = useState<Ejecucion>(initialEjecucion)
  const expandedPasoIdRef = useRef<string | null>(null)
  // HU-G18 — ref al <video> para que VideoChapterBar pueda hacer seek.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoDurationMs, setVideoDurationMs] = useState(0)
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setVideoDurationMs(Math.round((v.duration || 0) * 1000))
  }, [])

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
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Ejecución {ejecucionId.slice(0, 8)}</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">
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
        <span className="ml-auto" />
        {/* HU-G19 — generar/descargar acta de evidencia (solo en estados terminales) */}
        {!isRunning && ejecucion.estado !== 'pendiente' && (
          <GenerarActaButton
            ejecucionId={ejecucion.id}
            initialActa={
              ejecucion.acta
                ? {
                    id: ejecucion.acta.id,
                    consecutivo: ejecucion.acta.consecutivo,
                    pdfPath: ejecucion.acta.rutaPdf,
                    downloadUrl: `/api/actas/${ejecucion.acta.id}/download`,
                  }
                : null
            }
          />
        )}
        {canReRun && (
          <ReRunButton casoPruebaId={ejecucion.casoPruebaId} />
        )}
        {isRunning ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-m3-secondary/30 bg-m3-secondary-container/25 px-2.5 py-1 font-label text-label-sm font-semibold uppercase tracking-wide text-m3-on-secondary-container">
            <span className="h-2 w-2 animate-pulse rounded-full bg-m3-secondary" aria-hidden="true" />
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
          <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm overflow-hidden" data-purpose="summary-header">
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
          <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm flex flex-col flex-grow" data-purpose="test-steps-section">
            <div className="bg-m3-surface-container px-6 py-3 border-b border-m3-outline-variant flex justify-between items-center rounded-t-lg">
              <h3 className="font-label text-label-sm font-semibold text-m3-on-surface-variant uppercase tracking-wide">Pasos ejecutados</h3>
              <span className="font-label text-label-sm font-semibold text-m3-on-surface-variant">{ejecucion.pasos.length}</span>
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
          <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-4">
            <h3 className="font-label text-label-sm font-semibold text-m3-on-surface-variant uppercase tracking-wide mb-4 px-2">Video de la ejecución</h3>
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
                  ref={videoRef}
                  data-testid="video-player"
                  src={`/api/artefactos/${videoArtefacto.id}`}
                  controls
                  onLoadedMetadata={handleLoadedMetadata}
                  className="w-full h-full object-contain"
                />
                {/* HU-G18 — barra segmentada con click-to-seek + overlay "Paso N · …".
                    Si los pasos no tienen timestamps, el componente cae al
                    fallback por duracionMs (no necesitamos duplicar la lógica). */}
                <VideoChapterBar
                  pasos={ejecucion.pasos}
                  videoDurationMs={videoDurationMs}
                  videoRef={videoRef}
                />
                {/* Backwards-compat: para grabaciones legacy sin videoInicioMs/FinMs,
                    renderizamos la barra proporcional a duracionMs. Se muestra solo
                    cuando la nueva barra no encontró capítulos por timestamp. */}
                {videoDurationMs === 0 &&
                  totalDuracionMs > 0 &&
                  !ejecucion.pasos.some(
                    (p) => p.videoInicioMs != null && p.videoFinMs != null,
                  ) && (
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
          <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
            <div className="bg-m3-surface-container px-6 py-3 border-b border-m3-outline-variant rounded-t-lg">
              <h3 className="font-label text-label-sm font-semibold text-m3-on-surface-variant uppercase tracking-wide">Detalles de entorno</h3>
            </div>
            <div className="p-6">
              <EntornoDetails
                entorno={ejecucion.entorno}
                navegador={ejecucion.navegador}
                sistemaOperativo={ejecucion.sistemaOperativo}
                nodoEjecucion={ejecucion.nodoEjecucion}
              />
              <div className="mt-6 pt-6 border-t border-m3-outline-variant">
                <dt className="font-label text-[11px] font-semibold text-m3-on-surface-variant uppercase mb-3">Resumen de Aserciones</dt>
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

      <div className="mt-4 rounded-r border-l-2 border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-3.5 font-body text-body-sm leading-relaxed text-m3-on-surface-variant">
        <b className="font-semibold text-m3-on-surface">Cómo leer esta pantalla:</b> a la izquierda, el acta paso a paso con
        detalle expandible. A la derecha, el video de la ejecución y los detalles
        de entorno con resumen de aserciones.
      </div>
    </div>
  )
}
