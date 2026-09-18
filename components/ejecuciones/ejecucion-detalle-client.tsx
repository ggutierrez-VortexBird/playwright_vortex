'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { useBreadcrumbExtra } from '@/components/breadcrumb-context'
import { Button } from '@/components/ui/button'
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

function ArtefactoCard({ artefacto }: { artefacto: Artefacto }) {
  const iconMap: Record<string, string> = {
    video: 'videocam',
    screenshot: 'image',
    trace: 'account_tree',
  }
  const icon = iconMap[artefacto.tipo] ?? 'attach_file'
  const sizeKB = Math.round(artefacto.bytes / 1024)
  const sizeLabel = sizeKB > 1024 ? `${Math.round(sizeKB / 1024)} MB` : `${sizeKB} KB`

  return (
    <a
      href={`/api/artefactos/${artefacto.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-m3-outline-variant bg-m3-surface-container-low p-3 transition hover:border-m3-primary hover:bg-m3-surface-container"
    >
      <span className="material-symbols-outlined text-[20px] text-m3-on-surface-variant">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-label text-label-sm text-m3-on-surface">
          {artefacto.nombre}
        </div>
        <div className="font-label text-label-xs text-m3-on-surface-variant">
          {artefacto.tipo} · {sizeLabel}
        </div>
      </div>
      <span className="material-symbols-outlined text-[16px] text-m3-on-surface-variant">
        download
      </span>
    </a>
  )
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

  const { setExtra } = useBreadcrumbExtra()
  useEffect(() => {
    setExtra([{ label: caso.nombre }, { label: ejecucionId.slice(0, 8) }])
    return () => setExtra([])
  }, [caso.nombre, ejecucionId, setExtra])

  const isRunning = ejecucion.estado === 'corriendo'
  const isFailed = ejecucion.estado === 'fallo'
  const canReRun = ['paso', 'fallo', 'reparado', 'errorMotor', 'cancelado'].includes(
    ejecucion.estado
  )

  const videoArtefacto = ejecucion.artefactos.find((a) => a.tipo === 'video')
  const screenshotArtefactos = ejecucion.artefactos.filter((a) => a.tipo === 'screenshot')
  const traceArtefactos = ejecucion.artefactos.filter((a) => a.tipo === 'trace')
  const otherArtefactos = ejecucion.artefactos.filter(
    (a) => a.tipo !== 'video' && a.tipo !== 'screenshot' && a.tipo !== 'trace'
  )
  const totalDuracionMs = ejecucion.pasos.reduce((sum, p) => sum + (p.duracionMs ?? 0), 0)

  // First error for 200px visibility (PRD Criterio #6)
  const primerPasoFallido = ejecucion.pasos.find((p) => p.estado === 'fallo')
  const primerError = primerPasoFallido ?? (ejecucion.errorMsg ? null : null)
  const errorMsg =
    primerPasoFallido?.errorMsg ?? ejecucion.errorMsg ?? null

  const handleExpandedChange = useCallback((pasoId: string | null) => {
    expandedPasoIdRef.current = pasoId
  }, [])

  const formattedDate = ejecucion.inicioAt
    ? new Date(ejecucion.inicioAt).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  return (
    <div className="flex flex-col gap-6 accordion-panel">
      {/* Canonical PageHeader with breadcrumbs */}
      <PageHeader
        title={caso.nombre}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-mono-code text-[11px] text-m3-on-surface-variant">
              Ejecución #{ejecucionId.slice(0, 8)}
            </span>
            <span className="rounded bg-m3-surface-container-high px-1.5 py-0.5 font-mono-code text-[11px] text-m3-on-surface-variant">
              {caso.codigo}
            </span>
            <span className="inline-flex items-center gap-1 text-body-sm text-m3-on-surface-variant">
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                schedule
              </span>
              {formattedDate}
            </span>
          </div>
        }
        badge={
          isRunning
            ? { value: 'running', label: '' }
            : isFailed
              ? { value: 'failed', label: '' }
              : undefined
        }
        actions={
          <>
            {canReRun && <ReRunButton casoPruebaId={ejecucion.casoPruebaId} />}
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
          </>
        }
      />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Summary Card */}
          <div
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm overflow-hidden"
            data-purpose="summary-header"
          >
            <EjecucionSummary
              estado={ejecucion.estado}
              duracionMs={ejecucion.duracionMs}
              inicioAt={ejecucion.inicioAt ? new Date(ejecucion.inicioAt) : null}
              finAt={ejecucion.finAt ? new Date(ejecucion.finAt) : null}
              errorMsg={ejecucion.errorMsg}
              pasos={ejecucion.pasos}
            />
          </div>

          {/* CRITICAL — PRD Criterio #6: First error visible in 200px */}
          {isFailed && errorMsg && (
            <div
              className="rounded-lg border-2 border-m3-error bg-m3-error-container p-4"
              data-purpose="first-error"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 material-symbols-outlined text-[20px] text-m3-error">
                  error
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-label text-label-sm font-semibold text-m3-error uppercase tracking-wide">
                    {primerPasoFallido
                      ? `Fallo en paso ${primerPasoFallido.numero}: ${primerPasoFallido.descripcion}`
                      : 'Error de ejecución'}
                  </div>
                  <pre className="mt-2 whitespace-pre-wrap break-all font-mono-code text-mono-code text-body-sm text-m3-on-error-container">
                    {errorMsg}
                  </pre>
                  {/* Screenshot of failure if available */}
                  {primerPasoFallido?.subacciones
                    ?.find((s) => s.capturaActual)
                    ?.capturaActual && (
                    <img
                      src={`/api/artefactos/${primerPasoFallido.subacciones.find((s) => s.capturaActual)!.capturaActual!.id}`}
                      alt="Captura del momento del fallo"
                      className="mt-3 max-h-48 rounded border border-m3-error/30 object-contain"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Steps accordion */}
          <div
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm flex flex-col flex-grow"
            data-purpose="test-steps-section"
          >
            <div className="bg-m3-surface-container px-6 py-3 border-b border-m3-outline-variant flex justify-between items-center rounded-t-lg">
              <h3 className="font-label text-label-sm font-semibold text-m3-on-surface-variant uppercase tracking-wide">
                Pasos ejecutados
              </h3>
              <span className="font-label text-label-sm font-semibold text-m3-on-surface-variant">
                {ejecucion.pasos.length}
              </span>
            </div>
            <div
              className="flex flex-col flex-grow overflow-y-auto steps-scroll max-h-[800px]"
              data-purpose="steps-list"
            >
              <PasoAccordionList
                pasos={ejecucion.pasos}
                defaultExpandedId={expandedPasoIdRef.current}
                onExpandedChange={handleExpandedChange}
              />
            </div>
          </div>

          {/* Artefacts section */}
          {ejecucion.artefactos.length > 0 && (
            <div
              className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm"
              data-purpose="artefacts-section"
            >
              <div className="bg-m3-surface-container px-6 py-3 border-b border-m3-outline-variant rounded-t-lg">
                <h3 className="font-label text-label-sm font-semibold text-m3-on-surface-variant uppercase tracking-wide">
                  Artefactos
                </h3>
              </div>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ejecucion.artefactos.map((a) => (
                  <ArtefactoCard key={a.id} artefacto={a} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-[90px] self-start w-full">
          {/* Status chip row */}
          <div className="flex flex-wrap items-center gap-2">
            {isRunning && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-m3-secondary/30 bg-m3-secondary-container/25 px-2.5 py-1 font-label text-label-sm font-semibold uppercase tracking-wide text-m3-on-secondary-container">
                <span className="h-2 w-2 animate-pulse rounded-full bg-m3-secondary" aria-hidden="true" />
                Corriendo
              </span>
            )}
            {!isRunning && <EjecucionStatus estado={ejecucion.estado} pasos={ejecucion.pasos} />}
            {caso.origen && <OrigenChip origen={caso.origen} />}
            <ReparadosCounter pasos={ejecucion.pasos} />
            {ejecucion.estado === 'errorMotor' && (
              <ErrorMotorBadge message={ejecucion.errorMsg ?? ''} />
            )}
            <DetenerButton
              ejecucionId={ejecucion.id}
              visible={ejecucion.estado === 'pendiente' || ejecucion.estado === 'corriendo'}
            />
          </div>

          {/* Video */}
          <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-4">
            <h3 className="font-label text-label-sm font-semibold text-m3-on-surface-variant uppercase tracking-wide mb-4 px-2">
              Video de la ejecución
            </h3>
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
                <VideoChapterBar
                  pasos={ejecucion.pasos}
                  videoDurationMs={videoDurationMs}
                  videoRef={videoRef}
                />
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
              <h3 className="font-label text-label-sm font-semibold text-m3-on-surface-variant uppercase tracking-wide">
                Entorno
              </h3>
            </div>
            <div className="p-6">
              <EntornoDetails
                entorno={ejecucion.entorno}
                navegador={ejecucion.navegador}
                sistemaOperativo={ejecucion.sistemaOperativo}
                nodoEjecucion={ejecucion.nodoEjecucion}
              />
              <div className="mt-6 pt-6 border-t border-m3-outline-variant">
                <dt className="font-label text-[11px] font-semibold text-m3-on-surface-variant uppercase mb-3">
                  Resumen de Aserciones
                </dt>
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
    </div>
  )
}
