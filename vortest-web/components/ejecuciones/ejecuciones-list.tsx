'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EjecucionStatus } from './ejecucion-status'
import { Button } from '@/components/ui/button'
import { SectionSearch } from '@/components/ui/section-search'
import { formatDuration, formatFecha } from '@/lib/format'

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
  hasNextPage: boolean
  currentPage: number
  q?: string
  estado?: string
  /** La página de /ejecuciones agrupa por proyecto y pinta un único paginador numerado global. */
  mostrarPaginacion?: boolean
}

function buildUrl(page: number, q?: string, estado?: string) {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (q) params.set('q', q)
  if (estado) params.set('estado', estado)
  const qs = params.toString()
  return `/ejecuciones${qs ? `?${qs}` : ''}`
}

export function EjecucionesList({ ejecuciones, hasNextPage, currentPage, q, estado, mostrarPaginacion = true }: EjecucionesListProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState(q ?? '')

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return ejecuciones
    const sq = searchQuery.toLowerCase()
    return ejecuciones.filter(
      (e) =>
        e.casoPrueba.nombre.toLowerCase().includes(sq) ||
        e.casoPrueba.codigo.toLowerCase().includes(sq)
    )
  }, [ejecuciones, searchQuery])

  const totalCount = filtered.length

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    const url = buildUrl(1, value || undefined, estado)
    router.push(url)
  }

  const goToPage = (page: number) => {
    router.push(buildUrl(page, searchQuery || undefined, estado))
  }

  return (
    <div className="overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
      {/* Table header with search */}
      <div className="flex items-center gap-3 border-b border-m3-outline-variant bg-m3-surface-container px-4 py-2.5">
        <SectionSearch
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Buscar por nombre o código…"
          className="flex-1"
        />
        <span className="font-label text-label-xs text-m3-on-surface-variant whitespace-nowrap">
          {totalCount} resultado{totalCount !== 1 ? 's' : ''}
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
      {filtered.length === 0 ? (
        <div className="px-5 py-8 text-center font-body text-body-sm text-m3-on-surface-variant">
          No hay ejecuciones que coincidan con &quot;{searchQuery}&quot;
        </div>
      ) : (
        filtered.map((ejec) => (
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
              {formatFecha(ejec.createdAt, { anio: false })}
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

      {mostrarPaginacion && (
      <div className="flex flex-col items-center justify-between gap-4 border-t border-m3-outline-variant bg-m3-surface-container px-5 py-3 sm:flex-row">
        <p className="font-label text-label-xs text-m3-on-surface-variant">
          Página <span className="font-semibold text-m3-on-surface">{currentPage}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => goToPage(currentPage + 1)}
            disabled={!hasNextPage}
          >
            Siguiente
          </Button>
        </div>
      </div>
      )}
    </div>
  )
}
