'use client'

import { useState, useEffect, useCallback } from 'react'
import { PasosList } from './pasos-list'
import { ErrorMotorBadge } from './error-motor-badge'
import { EjecucionStatus } from './ejecucion-status'
import { EjecucionSummary } from './ejecucion-summary'
import { DetenerButton } from './detener-button'
import { ReRunButton } from './re-run-button'

interface Paso {
  id: string
  numero: number
  descripcion: string
  estado: string
  duracionMs: number | null
  selfHealed: boolean
  errorMsg: string | null
  createdAt: string
}

interface CasoPrueba {
  nombre: string
  codigo: string
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

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}`)
      if (!res.ok) return
      const data = await res.json()
      setEjecucion(data)
    } catch {
      // ignore polling errors
    }
  }, [ejecucionId])

  useEffect(() => {
    // Poll immediately and then every 2 seconds
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [poll])

  const caso = ejecucion.casoPrueba
  const ejecucionLabel = `EJC-${ejecucionId.slice(0, 8).toUpperCase()}`
  const isRunning = ejecucion.estado === 'corriendo'

  // Estados terminales donde se permite re-ejecutar
  const canReRun = ['paso', 'fallo', 'reparado', 'errorMotor', 'cancelado'].includes(
    ejecucion.estado
  )

  const videoArtefacto = ejecucion.artefactos.find((a) => a.tipo === 'video')
  const totalDuracionMs = ejecucion.pasos.reduce((sum, p) => sum + (p.duracionMs ?? 0), 0)

  const shotsByPaso: Record<string, Artefacto> = {}
  const unmappedShots: Artefacto[] = []
  for (const a of ejecucion.artefactos) {
    if (a.tipo === 'captura') {
      if (a.pasoEjecucionId) {
        shotsByPaso[a.pasoEjecucionId] = a
      } else {
        unmappedShots.push(a)
      }
    }
  }

  return (
    <div className="flex flex-col gap-6">
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

      {/* Run-grid */}
      <div className="run-grid">
        {/* Left column */}
        <div className="card overflow-hidden">
          <EjecucionSummary
            estado={ejecucion.estado}
            duracionMs={ejecucion.duracionMs}
            inicioAt={ejecucion.inicioAt ? new Date(ejecucion.inicioAt) : null}
            finAt={ejecucion.finAt ? new Date(ejecucion.finAt) : null}
            errorMsg={ejecucion.errorMsg}
            pasos={ejecucion.pasos}
          />
          <div className="ledger-head">
            <div className="eyebrow">Pasos ejecutados</div>
            <span className="tmeta">{ejecucion.pasos.length}</span>
          </div>
          <PasosList
            ejecucionId={ejecucionId}
            pasos={ejecucion.pasos}
          />
        </div>

        {/* Right column: video + shots */}
        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <div className="eyebrow mb-2">Video de la ejecución</div>
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
                  {ejecucion.estado === 'fallo'
                    ? 'Fallo · verificación'
                    : 'Paso destacado'}
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
                  {ejecucion.estado === 'fallo'
                    ? 'Fallo · verificación'
                    : 'Sin video'}
                </div>
                <div className="flex items-center justify-center text-white/70 text-sm">
                  No hay video disponible
                </div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="ledger-head">
              <div className="eyebrow">Capturas por paso</div>
              <span className="tmeta">{ejecucion.pasos.length}</span>
            </div>
            <div className="shots">
              {ejecucion.pasos.slice(0, 6).map((p) => {
                const shot = shotsByPaso[p.id]
                return (
                  <div
                    key={p.id}
                    className="shot"
                    style={
                      p.estado === 'fallo'
                        ? {
                            outline: '2px solid var(--stamp)',
                            outlineOffset: '-2px',
                          }
                        : undefined
                    }
                  >
                    {shot ? (
                      <img
                        src={`/api/artefactos/${shot.id}`}
                        alt={`Captura paso ${p.numero}`}
                        className="w-full h-full object-cover rounded-[4px]"
                      />
                    ) : (
                      <span>{p.numero.toString().padStart(2, '0')}</span>
                    )}
                  </div>
                )
              })}
              {Array.from({ length: Math.max(0, 3 - ejecucion.pasos.length) }).map(
                (_, i) => (
                  <div key={`empty-${i}`} className="shot" />
                )
              )}
            </div>
            {unmappedShots.length > 0 && (
              <div className="shots border-t border-[var(--rule)] mt-2 pt-2">
                {unmappedShots.map((shot) => (
                  <div key={shot.id} className="shot">
                    <img
                      src={`/api/artefactos/${shot.id}`}
                      alt="Captura"
                      className="w-full h-full object-cover rounded-[4px]"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="note">
        <b>Cómo leer esta pantalla:</b> a la izquierda, el acta paso a paso. Cada
        renglón que llega después del inicio se resalta con un trazo corto
        (<code className="font-mono">.new</code>). Los pasos que la herramienta
        tuvo que reparar aparecen con fondo crema; los que fallaron, con fondo
        rosado y número en rojo. A la derecha, el video y las capturas son la
        evidencia auditable.
      </div>
    </div>
  )
}
