import { db } from '@/lib/db'
import { listEjecucionesPorProyecto } from '@/lib/ejecuciones/queries'
import { EjecutarCasoButton } from '@/components/ejecuciones/ejecutar-button'
import { EjecucionStatus } from '@/components/ejecuciones/ejecucion-status'

export default async function EjecucionesPage() {
  const porProyecto = await listEjecucionesPorProyecto()

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-[--ink]">Ejecuciones</h1>

      {Object.entries(porProyecto).map(([proyectoId, ejecuciones]) => (
        <section key={proyectoId}>
          <h2 className="text-sm font-medium text-[--ink] mb-3">
            {ejecuciones[0].casoPrueba.proyecto.nombre}
            <span className="text-[--rule] ml-2">
              {ejecuciones[0].casoPrueba.proyecto.espacio.nombre}
            </span>
          </h2>

          <div className="space-y-2">
            {ejecuciones.map(ejec => (
              <a
                key={ejec.id}
                href={`/ejecuciones/${ejec.id}`}
                className="flex items-center gap-3 p-3 bg-[--surface] border border-[--rule] rounded hover:border-[--ink] transition-colors"
              >
                <EjecucionStatus estado={ejec.estado} />
                <span className="font-mono text-sm">
                  {ejec.casoPrueba.codigo}
                </span>
                <span className="text-sm text-[--ink]">
                  {ejec.casoPrueba.nombre}
                </span>
                <span className="text-xs text-[--rule]">
                  {ejec.createdAt.toLocaleString()}
                </span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
