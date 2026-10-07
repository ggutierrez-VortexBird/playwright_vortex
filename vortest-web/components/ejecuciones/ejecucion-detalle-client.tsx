'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { useBreadcrumbExtra, type BreadcrumbSegment } from '@/components/breadcrumb-context'
import { Alert } from '@/components/ui/alert'
import { EstadoBadge } from '@/components/ui/status-badge'
import { useToast } from '@/components/ui/toast'
import { PasoAccordionList } from './paso-accordion-list'
import { EntornoDetails } from './entorno-details'
import { AsercionesResumen } from './aserciones-resumen'
import { ErrorMotorBadge } from './error-motor-badge'
import { EjecucionSummary } from './ejecucion-summary'
import { DetenerButton } from './detener-button'
import { ReRunButton } from './re-run-button'
import { OrigenChip } from './origen-chip'
import { VideoChapterBar } from './video-chapter-bar'
import { GenerarActaButton } from './generar-acta-button'
import { VisorEvidencia } from './visor-evidencia'
import { formatFecha } from '@/lib/format'
import { estadoVisual, estaEnCurso, resultadoEjecucionLabel } from '@/lib/ejecuciones/estado'
import { useEjecucionEnVivo } from '@/lib/ejecuciones/use-ejecucion-en-vivo'
import { formatDuration } from '@/lib/format'

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
  acta?: { id: string; consecutivo: string } | null
}

interface Props {
  ejecucionId: string
  initialEjecucion: Ejecucion
  /** Ruta completa Espacio › Proyecto › Caso › Ejecución, armada en el servidor. */
  migas?: BreadcrumbSegment[]
}

const TIPO_ARTEFACTO: Record<string, string> = {
  video: 'Video',
  screenshot: 'Captura',
  trace: 'Traza de Playwright',
  log: 'Registro',
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

  // Visor propio (app/trace-viewer): mismo origen, así lleva la cookie de sesión y la evidencia no sale a un sitio externo.
  const isTrace = artefacto.tipo === 'trace'
  const traceUrl = isTrace ? `/trace-viewer/index.html?trace=/api/artefactos/${artefacto.id}` : null

  if (isTrace && traceUrl) {
    return (
      <a
        href={traceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg border border-m3-outline-variant bg-m3-surface-container-low p-3 transition hover:border-m3-primary hover:bg-m3-surface-container"
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-m3-on-surface-variant">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-label text-label-sm text-m3-on-surface">
            {artefacto.nombre}
          </div>
          <div className="font-label text-label-xs text-m3-on-surface-variant">
            {TIPO_ARTEFACTO[artefacto.tipo] ?? 'Archivo'} · {sizeLabel} · Abrir en el visor de trazas
          </div>
        </div>
        <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-m3-on-surface-variant">
          open_in_new
        </span>
      </a>
    )
  }

  return (
    <a
      href={`/api/artefactos/${artefacto.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-m3-outline-variant bg-m3-surface-container-low p-3 transition hover:border-m3-primary hover:bg-m3-surface-container"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[20px] text-m3-on-surface-variant">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-label text-label-sm text-m3-on-surface">
          {artefacto.nombre}
        </div>
        <div className="font-label text-label-xs text-m3-on-surface-variant">
          {TIPO_ARTEFACTO[artefacto.tipo] ?? 'Archivo'} · {sizeLabel}
        </div>
      </div>
      <span aria-hidden="true" className="material-symbols-outlined text-[16px] text-m3-on-surface-variant">
        download
      </span>
    </a>
  )
}

export function EjecucionDetalleClient({ ejecucionId, initialEjecucion, migas }: Props) {
  const { ejecucion, conexion, refrescar } = useEjecucionEnVivo<Ejecucion>(ejecucionId, initialEjecucion)
  const [expandedPasoId, setExpandedPasoId] = useState<string | null>(null)
  const toast = useToast()
  // HU-G18 — ref al <video> para que VideoChapterBar pueda hacer seek.
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoDurationMs, setVideoDurationMs] = useState(0)
  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    setVideoDurationMs(Math.round((v.duration || 0) * 1000))
  }, [])

  // Si el paso abierto desaparece al refrescar, se abre el primero.
  const pasoExpandido =
    expandedPasoId && !ejecucion.pasos.some((p) => p.id === expandedPasoId) ? ejecucion.pasos[0]?.id ?? null : expandedPasoId

  // Aviso al terminar (toast + región viva) y título de pestaña con el estado, útil con la pestaña en segundo plano.
  const estadoPrevio = useRef(initialEjecucion.estado)
  useEffect(() => {
    const visual = estadoVisual(ejecucion.estado)
    document.title = `${visual.label} · ${ejecucion.casoPrueba.nombre} · vorTest`
    const antes = estadoPrevio.current
    estadoPrevio.current = ejecucion.estado
    if (!estaEnCurso(antes) || estaEnCurso(ejecucion.estado) || ejecucion.estado === 'cancelado') return
    const fallido = ejecucion.pasos.find((p) => p.estado === 'fallo')?.numero
    toast({
      tone: visual.tone,
      title: `Ejecución terminada: ${resultadoEjecucionLabel(ejecucion.estado, fallido)}`,
      description: ejecucion.duracionMs != null ? `Duró ${formatDuration(ejecucion.duracionMs)}. Ya puedes generar el acta.` : undefined,
      duration: 10000,
    })
  }, [ejecucion.estado, ejecucion.casoPrueba.nombre, ejecucion.duracionMs, ejecucion.pasos, toast])

  const caso = ejecucion.casoPrueba

  const { setExtra } = useBreadcrumbExtra()
  useEffect(() => {
    setExtra(migas ?? [{ label: caso.nombre }, { label: ejecucionId.slice(0, 8) }], { reemplazarBase: Boolean(migas) })
    return () => setExtra([])
  }, [caso.nombre, ejecucionId, setExtra, migas])

  const isRunning = ejecucion.estado === 'corriendo'
  const enCurso = estaEnCurso(ejecucion.estado)
  const isFailed = ejecucion.estado === 'fallo'
  const canReRun = !enCurso

  const videoArtefacto = ejecucion.artefactos.find((a) => a.tipo === 'video')
  const totalDuracionMs = ejecucion.pasos.reduce((sum, p) => sum + (p.duracionMs ?? 0), 0)

  // First error for 200px visibility (PRD Criterio #6)
  const primerPasoFallido = ejecucion.pasos.find((p) => p.estado === 'fallo')
  const errorMsg =
    primerPasoFallido?.errorMsg ?? ejecucion.errorMsg ?? null

  const handleExpandedChange = useCallback((pasoId: string | null) => setExpandedPasoId(pasoId), [])

  const formattedDate = formatFecha(ejecucion.inicioAt)

  return (
    <div className="flex flex-col gap-6 accordion-panel">
      {/* Canonical PageHeader with breadcrumbs */}
      <PageHeader
        title={caso.nombre}
        subtitle={
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <EstadoBadge estado={ejecucion.estado} primerPasoFallido={primerPasoFallido?.numero} />
            <span className="font-mono-code text-label-xs text-m3-on-surface-variant">
              Ejecución #{ejecucionId.slice(0, 8)}
            </span>
            <span className="rounded bg-m3-surface-container-high px-1.5 py-0.5 font-mono-code text-label-xs text-m3-on-surface-variant">
              {caso.codigo}
            </span>
            <span className="inline-flex items-center gap-1 text-body-sm text-m3-on-surface-variant">
              <span aria-hidden="true" className="material-symbols-outlined text-[14px]">
                schedule
              </span>
              {formattedDate}
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap items-start justify-end gap-2">
            <DetenerButton ejecucionId={ejecucion.id} visible={enCurso} onDetenida={refrescar} />
            {canReRun && <ReRunButton casoPruebaId={ejecucion.casoPruebaId} />}
            {!enCurso && (
              <GenerarActaButton
                ejecucionId={ejecucion.id}
                initialActa={
                  ejecucion.acta
                    ? {
                        id: ejecucion.acta.id,
                        consecutivo: ejecucion.acta.consecutivo,
                        pdfPath: '',
                        downloadUrl: `/api/actas/${ejecucion.acta.id}/download`,
                      }
                    : null
                }
              />
            )}
          </div>
        }
      />

      {conexion === 'reintentando' && (
        <Alert tone="warning" title="Se perdió la conexión con el servidor">
          Seguimos intentando; el estado que ves puede estar desactualizado.
        </Alert>
      )}
      {conexion === 'sesion-vencida' && (
        <Alert
          tone="warning"
          title="Tu sesión venció"
          action={<Link href={`/login?from=/ejecuciones/${ejecucionId}`} className="font-label text-label-md font-semibold underline">Iniciar sesión</Link>}
        >
          La ejecución sigue en el motor; vuelve a entrar para ver el resultado.
        </Alert>
      )}
      {ejecucion.estado === 'pendiente' && (
        <Alert tone="info" title="En cola">
          Esperando un motor libre. Empieza sola; puedes cerrar esta página y volver luego.
        </Alert>
      )}

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
                <span aria-hidden="true" className="mt-0.5 material-symbols-outlined text-[20px] text-m3-error">
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
                    <VisorEvidencia
                      src={`/api/artefactos/${primerPasoFallido.subacciones.find((s) => s.capturaActual)!.capturaActual!.id}`}
                      alt="Captura del momento del fallo"
                      titulo={`Captura del fallo · paso ${primerPasoFallido.numero}`}
                      className="mt-3 max-w-md"
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
                defaultExpandedId={pasoExpandido}
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
            {caso.origen && <OrigenChip origen={caso.origen} />}
            {ejecucion.estado === 'errorMotor' && (
              <ErrorMotorBadge message={ejecucion.errorMsg ?? ''} />
            )}
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
                  {ejecucion.estado === 'fallo' ? 'No conforme' : 'Paso destacado'}
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
                  {ejecucion.estado === 'fallo' ? 'No conforme' : 'Sin video'}
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
                <h4 className="font-label text-label-xs font-semibold text-m3-on-surface-variant uppercase mb-3">
                  Resumen de Aserciones
                </h4>
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
