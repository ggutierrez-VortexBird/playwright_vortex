'use client'

import { useMemo, useState } from 'react'
import { EjecucionStatus } from './ejecucion-status'

const PAGE_SIZE = 10

interface EjecucionListItem {
  id: string
  estado: string
  createdAt: Date
  casoPrueba: {
    nombre: string
    codigo: string
  }
}

interface EjecucionesListProps {
  ejecuciones: EjecucionListItem[]
}

export function EjecucionesList({ ejecuciones }: EjecucionesListProps) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(ejecuciones.length / PAGE_SIZE))
  const paginaActual = Math.min(page, totalPages)
  const ejecucionesPagina = useMemo(
    () => ejecuciones.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE),
    [ejecuciones, paginaActual]
  )

  return (
    <div className="overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
      {ejecucionesPagina.map((ejec) => (
        <div
          key={ejec.id}
          className="flex items-center gap-3.5 border-b border-m3-outline-variant px-5 py-4 last:border-b-0 hover:bg-m3-surface-container-high"
        >
          <EjecucionStatus estado={ejec.estado} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-body text-body-md font-medium text-m3-on-surface">
              {ejec.casoPrueba.nombre}
            </div>
            <div className="mt-0.5 font-mono-code text-mono-code text-m3-on-surface-variant">
              {ejec.casoPrueba.codigo} ·{' '}
              {ejec.createdAt.toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
          <a
            href={`/ejecuciones/${ejec.id}`}
            aria-label={`Ver detalle de la ejecución de ${ejec.casoPrueba.codigo}`}
            title="Ver detalle"
            className="shrink-0 rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container hover:text-m3-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </a>
        </div>
      ))}

      <div className="flex flex-col items-center justify-between gap-4 border-t border-m3-outline-variant bg-m3-surface-container px-5 py-3 text-xs text-m3-on-surface-variant sm:flex-row">
        <p>
          Mostrando <span className="font-semibold text-m3-on-surface">{ejecucionesPagina.length}</span> de{' '}
          <span className="font-semibold text-m3-on-surface">{ejecuciones.length}</span> ejecuciones registradas
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={paginaActual <= 1}
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-medium text-m3-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="rounded-lg border border-m3-info bg-m3-info-container px-3 py-1.5 font-bold text-m3-info">
            {paginaActual}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={paginaActual >= totalPages}
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-medium text-m3-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
