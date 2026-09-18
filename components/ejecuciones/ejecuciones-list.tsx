'use client'

import { useMemo, useState } from 'react'
import { EjecucionStatus } from './ejecucion-status'
import { Button } from '@/components/ui/button'

const PAGE_SIZE = 10

interface EjecucionListItem {
  id: string
  estado: string
  createdAt: Date
  duracionMs: number | null
  casoPrueba: {
    nombre: string
    codigo: string
  }
}

interface EjecucionesListProps {
  ejecuciones: EjecucionListItem[]
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes > 0) return `${minutes}m ${remainder.toString().padStart(2, '0')}s`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatTimestamp(d: Date): string {
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function EjecucionesList({ ejecuciones }: EjecucionesListProps) {
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return ejecuciones
    const q = searchQuery.toLowerCase()
    return ejecuciones.filter(
      (e) =>
        e.casoPrueba.nombre.toLowerCase().includes(q) ||
        e.casoPrueba.codigo.toLowerCase().includes(q)
    )
  }, [ejecuciones, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginaActual = Math.min(page, totalPages)
  const ejecucionesPagina = useMemo(
    () => filtered.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE),
    [filtered, paginaActual]
  )

  // Reset to page 1 when search changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPage(1)
  }

  return (
    <div className="overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
      {/* Table header with search */}
      <div className="flex items-center gap-3 border-b border-m3-outline-variant bg-m3-surface-container px-4 py-2.5">
        <div className="flex max-w-xs flex-1 items-center gap-2 rounded-full border border-m3-outline-variant bg-m3-surface px-3.5 py-2 text-m3-on-surface-variant transition-colors focus-within:border-m3-secondary">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            placeholder="Buscar por nombre o código…"
            aria-label="Buscar por nombre o código"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full bg-transparent font-body text-body-sm text-m3-on-surface placeholder:text-m3-on-surface-variant focus:outline-none"
          />
        </div>
        <span className="font-label text-label-xs text-m3-on-surface-variant whitespace-nowrap">
          {filtered.length} resultado{filtered.length !== 1 ? 'es' : ''}
        </span>
      </div>

      {/* Table column headers (desktop) */}
      <div className="hidden md:grid md:grid-cols-12 border-b border-m3-outline-variant bg-m3-surface-container-low px-5 py-2 gap-4 font-label text-label-xs text-m3-on-surface-variant uppercase tracking-wide">
        <div className="col-span-5">Caso</div>
        <div className="col-span-2">Estado</div>
        <div className="col-span-2">Duración</div>
        <div className="col-span-2">Inicio</div>
        <div className="col-span-1" />
      </div>

      {/* Table rows */}
      {ejecucionesPagina.length === 0 ? (
        <div className="px-5 py-8 text-center font-body text-body-sm text-m3-on-surface-variant">
          No hay ejecuciones que coincidan con &quot;{searchQuery}&quot;
        </div>
      ) : (
        ejecucionesPagina.map((ejec) => (
          <div
            key={ejec.id}
            className="grid grid-cols-12 items-center gap-4 border-b border-m3-outline-variant px-5 py-3 last:border-b-0 hover:bg-m3-surface-container-high md:py-4"
          >
            {/* Caso */}
            <div className="col-span-12 md:col-span-5">
              <div className="truncate font-body text-body-md font-medium text-m3-on-surface">
                {ejec.casoPrueba.nombre}
              </div>
              <div className="mt-0.5 font-mono-code text-mono-code text-m3-on-surface-variant">
                {ejec.casoPrueba.codigo}
              </div>
            </div>

            {/* Estado */}
            <div className="col-span-6 md:col-span-2">
              <EjecucionStatus estado={ejec.estado} />
            </div>

            {/* Duración */}
            <div className="col-span-6 md:col-span-2 font-body text-body-sm text-m3-on-surface">
              {formatDuration(ejec.duracionMs)}
            </div>

            {/* Inicio */}
            <div className="col-span-6 md:col-span-2 font-body text-body-sm text-m3-on-surface-variant">
              {formatTimestamp(ejec.createdAt)}
            </div>

            {/* Acciones */}
            <div className="col-span-6 md:col-span-1 flex justify-end">
              <a
                href={`/ejecuciones/${ejec.id}`}
                aria-label={`Ver detalle de la ejecución ${ejec.casoPrueba.codigo}`}
                title="Ver detalle"
                className="shrink-0 rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container hover:text-m3-primary"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </a>
            </div>
          </div>
        ))
      )}

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-4 border-t border-m3-outline-variant bg-m3-surface-container px-5 py-3 sm:flex-row">
          <p className="font-label text-label-xs text-m3-on-surface-variant">
            Página <span className="font-semibold text-m3-on-surface">{paginaActual}</span> de{' '}
            <span className="font-semibold text-m3-on-surface">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={paginaActual <= 1}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={paginaActual >= totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
