import type { Metadata } from 'next'
import { Suspense } from 'react'
import { contarEjecucionesPorEstado, listEjecucionesPorProyecto } from '@/lib/ejecuciones/queries'
import { esFiltroEstado } from '@/lib/ejecuciones/estado'
import { EjecucionesList } from '@/components/ejecuciones/ejecuciones-list'
import { PaginacionEjecuciones } from '@/components/ejecuciones/paginacion-ejecuciones'
import { FiltrosEjecuciones } from '@/components/ejecuciones/filtros-ejecuciones'
import { getSession, getUsuarioActual } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Ejecuciones' }

interface EjecucionesPageProps {
  searchParams: Promise<{ q?: string; estado?: string; page?: string }>
}

const POR_PAGINA = 20

const SEGMENTOS = [
  { estados: ['paso'], clase: 'bg-m3-success', etiqueta: (n: number) => (n === 1 ? 'conforme' : 'conformes') },
  { estados: ['fallo'], clase: 'bg-m3-error', etiqueta: (n: number) => (n === 1 ? 'no conforme' : 'no conformes') },
  { estados: ['errorMotor'], clase: 'bg-m3-warning', etiqueta: () => 'con error del motor' },
  { estados: ['pendiente', 'corriendo'], clase: 'bg-m3-info', etiqueta: () => 'en curso' },
  { estados: ['cancelado'], clase: 'bg-m3-outline', etiqueta: (n: number) => (n === 1 ? 'cancelada' : 'canceladas') },
]

export default async function EjecucionesPage({ searchParams }: EjecucionesPageProps) {
  const { q, estado, page: pageParam } = await searchParams
  const session = await getSession()
  const usuario = await getUsuarioActual(session)

  const currentPage = Math.max(1, Number(pageParam) || 1)
  const query = q?.trim() || undefined
  const filtroEstado = esFiltroEstado(estado) ? estado : undefined

  const [{ porProyecto, total }, conteo] = await Promise.all([
    listEjecucionesPorProyecto(usuario, currentPage, POR_PAGINA, query, filtroEstado),
    contarEjecucionesPorEstado(usuario, query),
  ])

  const totalGeneral = Object.values(conteo).reduce((s, n) => s + n, 0)
  const segmentos = SEGMENTOS.map((s) => ({ ...s, n: s.estados.reduce((acc, e) => acc + (conteo[e] ?? 0), 0) })).filter((s) => s.n > 0)
  const hayFiltros = Boolean(query || filtroEstado)
  const grupos = Object.entries(porProyecto)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ejecuciones"
        subtitle={
          hayFiltros
            ? `${total} de ${totalGeneral} ejecuciones coinciden con el filtro`
            : `${totalGeneral} ejecuciones en tus proyectos`
        }
        actions={
          <ButtonLink href="/casos" icon="play_arrow">
            Ejecutar un caso
          </ButtonLink>
        }
      />

      {totalGeneral > 0 && (
        <section aria-label="Resumen de resultados" className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-3 shadow-card">
          <div className="flex h-2 overflow-hidden rounded-full bg-m3-surface-container-high" aria-hidden="true">
            {segmentos.map((s) => (
              <div key={s.clase} className={`${s.clase} transition-[width] duration-slow ease-standard`} style={{ width: `${(s.n / totalGeneral) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-label text-label-sm">
            {segmentos.map((s) => (
              <li key={s.clase} className="inline-flex items-center gap-1.5 text-m3-on-surface-variant">
                <span className={`h-2 w-2 rounded-full ${s.clase}`} aria-hidden="true" />
                <span className="font-semibold tabular-nums text-m3-on-surface">{s.n}</span> {s.etiqueta(s.n)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {totalGeneral > 0 || hayFiltros ? (
        <Suspense>
          <FiltrosEjecuciones conteo={conteo} q={query} estado={filtroEstado} />
        </Suspense>
      ) : null}

      {grupos.length === 0 ? (
        hayFiltros ? (
          <EmptyState
            icon="search_off"
            title="Ninguna ejecución coincide"
            description={query ? `No hay ejecuciones para “${query}” con este filtro.` : 'No hay ejecuciones con este estado.'}
            action={
              <ButtonLink href="/ejecuciones" variant="secondary" size="sm" icon="filter_alt_off">
                Quitar filtros
              </ButtonLink>
            }
          />
        ) : (
          <EmptyState
            icon="play_circle"
            title="Todavía no hay ejecuciones"
            description="Ejecuta un caso de prueba y aquí verás su progreso, el resultado y la evidencia."
            action={
              <ButtonLink href="/casos" size="sm" icon="play_arrow">
                Ir a casos
              </ButtonLink>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-8">
          {grupos.map(([proyectoId, ejecuciones]) => {
            const proyecto = ejecuciones[0].casoPrueba.proyecto
            return (
              <section key={proyectoId} aria-labelledby={`grupo-${proyectoId}`} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: proyecto.espacio.color }} aria-hidden="true" />
                  <h2 id={`grupo-${proyectoId}`} className="font-headline text-headline-md text-m3-on-surface">
                    {proyecto.nombre}
                  </h2>
                  <span className="font-body text-body-sm text-m3-on-surface-variant">{proyecto.espacio.nombre}</span>
                  <span className="ml-auto font-label text-label-sm text-m3-on-surface-variant">
                    {ejecuciones.length} en esta página
                  </span>
                </div>
                <EjecucionesList ejecuciones={ejecuciones} hasNextPage={false} currentPage={currentPage} mostrarPaginacion={false} mostrarBuscador={false} />
              </section>
            )
          })}
          <PaginacionEjecuciones
            paginaActual={currentPage}
            totalPaginas={Math.max(1, Math.ceil(total / POR_PAGINA))}
            total={total}
            q={query}
            estado={filtroEstado}
          />
        </div>
      )}
    </div>
  )
}
