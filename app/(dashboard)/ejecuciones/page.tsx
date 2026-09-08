import { listEjecucionesPorProyecto } from '@/lib/ejecuciones/queries'
import { EjecucionStatus } from '@/components/ejecuciones/ejecucion-status'

export default async function EjecucionesPage() {
  const porProyecto = await listEjecucionesPorProyecto()
  const totalEjecuciones = Object.values(porProyecto).reduce(
    (sum, list) => sum + list.length,
    0
  )
  const proyectos = Object.keys(porProyecto).length

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Ejecuciones</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">
          {totalEjecuciones} ejecuciones · {proyectos} proyectos
        </span>
        <span className="ml-auto" />
      </div>

      {proyectos === 0 ? (
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-8 text-center">
          <p className="text-m3-on-surface-variant">Aún no hay ejecuciones registradas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(porProyecto).map(([proyectoId, ejecuciones]) => {
            const proyecto = ejecuciones[0].casoPrueba.proyecto
            return (
              <section key={proyectoId} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: proyecto.espacio.color }}
                  />
                  <h3 className="font-headline text-headline-md text-m3-primary">
                    {proyecto.nombre}
                  </h3>
                  <span className="font-body text-body-sm text-m3-on-surface-variant">
                    {proyecto.espacio.nombre}
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
                  {ejecuciones.map((ejec) => (
                    <a
                      key={ejec.id}
                      href={`/ejecuciones/${ejec.id}`}
                      className="flex items-center gap-3.5 border-b border-m3-outline-variant px-5 py-4 text-inherit no-underline last:border-b-0 hover:bg-m3-surface-container-high"
                    >
                      <EjecucionStatus estado={ejec.estado} />
                      <div className="flex-1">
                        <div className="font-body text-body-md font-medium text-m3-on-surface">
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
                      <span className="font-body text-body-sm text-m3-on-surface-variant">
                        ver →
                      </span>
                    </a>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
