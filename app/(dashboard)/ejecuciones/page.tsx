import { listEjecucionesPorProyecto } from '@/lib/ejecuciones/queries'
import { EjecucionesList } from '@/components/ejecuciones/ejecuciones-list'
import { getSession, getUsuarioActual } from '@/lib/auth'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { ButtonLink } from '@/components/ui/button'

interface EjecucionesPageProps {
  searchParams: Promise<{ q?: string; estado?: string }>
}

export default async function EjecucionesPage({ searchParams }: EjecucionesPageProps) {
  const { q, estado } = await searchParams
  const session = await getSession()
  const usuario = await getUsuarioActual(session)
  const porProyectoSinFiltrar = await listEjecucionesPorProyecto(usuario)

  const query = q?.trim().toLowerCase()
  const filtroEstado = estado?.trim()

  // Aggregate totals for ExecutionStatusBar
  let totalPassed = 0
  let totalFailed = 0
  let totalSkipped = 0
  let totalCount = 0

  const porProyecto = { ...porProyectoSinFiltrar }

  // Apply state filter
  if (filtroEstado && filtroEstado !== 'todas') {
    for (const [proyectoId, ejecuciones] of Object.entries(porProyecto)) {
      const filtradas = ejecuciones.filter((e) => e.estado === filtroEstado)
      if (filtradas.length > 0) {
        porProyecto[proyectoId] = filtradas
      } else {
        delete porProyecto[proyectoId]
      }
    }
  }

  // Apply search query filter
  if (query) {
    for (const [proyectoId, ejecuciones] of Object.entries(porProyecto)) {
      const filtradas = ejecuciones.filter(
        (e) =>
          e.casoPrueba.nombre.toLowerCase().includes(query) ||
          e.casoPrueba.codigo.toLowerCase().includes(query)
      )
      if (filtradas.length > 0) {
        porProyecto[proyectoId] = filtradas
      } else {
        delete porProyecto[proyectoId]
      }
    }
  }

  // Calculate global totals from the UNFILTERED dataset (for status bar)
  for (const ejecs of Object.values(porProyectoSinFiltrar)) {
    for (const e of ejecs) {
      totalCount++
      if (e.estado === 'paso') totalPassed++
      else if (e.estado === 'fallo') totalFailed++
      else totalSkipped++
    }
  }

  const proyectos = Object.keys(porProyecto).length
  const totalEjecuciones = Object.values(porProyecto).reduce(
    (sum, list) => sum + list.length,
    0
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ejecuciones"
        subtitle={`${totalCount} ejecuciones en ${Object.keys(porProyectoSinFiltrar).length} proyectos`}
        badge={{ value: totalEjecuciones, label: 'visibles' }}
        actions={
          <ButtonLink href="/casos" className="inline-flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">add</span>
            Nueva ejecución
          </ButtonLink>
        }
      />

      {/* Global status bar — only show if we have data */}
      {totalCount > 0 && (totalPassed > 0 || totalFailed > 0 || totalSkipped > 0) && (
        <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-3">
          <div className="mb-2 font-label text-label-xs text-m3-on-surface-variant uppercase tracking-wide">
            Resumen global
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-m3-surface-container-high">
              {totalPassed > 0 && (
                <div
                  className="bg-m3-success transition-all duration-300"
                  style={{ width: `${Math.round((totalPassed / totalCount) * 100)}%` }}
                />
              )}
              {totalFailed > 0 && (
                <div
                  className="bg-m3-error transition-all duration-300"
                  style={{ width: `${Math.round((totalFailed / totalCount) * 100)}%` }}
                />
              )}
              {totalSkipped > 0 && (
                <div
                  className="bg-m3-on-surface-variant transition-all duration-300"
                  style={{ width: `${Math.round((totalSkipped / totalCount) * 100)}%` }}
                />
              )}
            </div>
            <div className="flex items-center gap-3 font-label text-label-sm">
              {totalPassed > 0 && (
                <span className="text-m3-success">
                  <span className="font-semibold">{totalPassed}</span>
                  <span className="text-m3-on-surface-variant ml-1">pasó</span>
                </span>
              )}
              {totalFailed > 0 && (
                <span className="text-m3-error">
                  <span className="font-semibold">{totalFailed}</span>
                  <span className="text-m3-on-surface-variant ml-1">falló</span>
                </span>
              )}
              {totalSkipped > 0 && (
                <span className="text-m3-on-surface-variant">
                  <span className="font-semibold">{totalSkipped}</span>
                  <span className="ml-1">omitido</span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {proyectos === 0 ? (
        <EmptyState
          icon="play_circle"
          title="Sin ejecuciones"
          description="Aún no hay ejecuciones registradas. Ejecuta un caso de prueba para ver los resultados aquí."
          action={
            <ButtonLink href="/casos" size="sm">
              Ir a casos
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(porProyecto).map(([proyectoId, ejecuciones]) => {
            const proyecto = ejecuciones[0].casoPrueba.proyecto
            return (
              <section key={proyectoId} className="flex flex-col gap-3">
                {/* Project group header with color accent */}
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: proyecto.espacio.color }}
                  />
                  <h3 className="font-headline text-headline-md text-m3-primary">
                    {proyecto.nombre}
                  </h3>
                  <span className="font-body text-body-sm text-m3-on-surface-variant">
                    {proyecto.espacio.nombre}
                  </span>
                  <span className="ml-auto font-label text-label-sm text-m3-on-surface-variant">
                    {ejecuciones.length} ejecucion{ejecuciones.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                <EjecucionesList ejecuciones={ejecuciones} />
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
