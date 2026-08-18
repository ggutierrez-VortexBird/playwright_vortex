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
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Ejecuciones</h2>
        <span className="sub">
          {totalEjecuciones} ejecuciones · {proyectos} proyectos
        </span>
        <span className="spacer" />
      </div>

      {proyectos === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3">Aún no hay ejecuciones registradas.</p>
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
                  <h3 className="text-base font-semibold text-ink">
                    {proyecto.nombre}
                  </h3>
                  <span className="tmeta">
                    {proyecto.espacio.nombre}
                  </span>
                </div>
                <div className="card overflow-hidden">
                  {ejecuciones.map((ejec, i) => (
                    <a
                      key={ejec.id}
                      href={`/ejecuciones/${ejec.id}`}
                      className="cred-row"
                      style={{
                        borderBottom:
                          i === ejecuciones.length - 1
                            ? 'none'
                            : '1px solid var(--rule-soft)',
                        textDecoration: 'none',
                        color: 'inherit',
                      }}
                    >
                      <EjecucionStatus estado={ejec.estado} />
                      <div style={{ flex: 1 }}>
                        <div className="nm">{ejec.casoPrueba.nombre}</div>
                        <div className="dt">
                          {ejec.casoPrueba.codigo} ·{' '}
                          {ejec.createdAt.toLocaleString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                      <span className="tmeta">ver →</span>
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
