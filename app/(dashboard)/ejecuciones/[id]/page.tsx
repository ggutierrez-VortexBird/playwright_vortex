import { getEjecucionConPasos } from '@/lib/ejecuciones/queries'
import { PasosList } from '@/components/ejecuciones/pasos-list'
import { ErrorMotorBadge } from '@/components/ejecuciones/error-motor-badge'
import { EjecucionStatus } from '@/components/ejecuciones/ejecucion-status'
import { EjecucionSummary } from '@/components/ejecuciones/ejecucion-summary'
import { notFound } from 'next/navigation'

export default async function EjecucionDetallePage({
  params
}: {
  params: { id: string }
}) {
  const ejecucion = await getEjecucionConPasos(params.id)

  if (!ejecucion) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-[--ink]">
          Ejecución {ejecucion.id.slice(0, 8)}
        </h1>
        <EjecucionStatus estado={ejecucion.estado} />
        {ejecucion.estado === 'errorMotor' && (
          <ErrorMotorBadge message={ejecucion.errorMsg ?? ''} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-[--rule]">Caso:</span>{' '}
          <span className="font-mono">{ejecucion.casoPrueba.codigo}</span>
        </div>
        <div>
          <span className="text-[--rule]">Duración:</span>{' '}
          {ejecucion.duracionMs ? `${ejecucion.duracionMs}ms` : '—'}
        </div>
      </div>

      <EjecucionSummary
        estado={ejecucion.estado}
        duracionMs={ejecucion.duracionMs}
        inicioAt={ejecucion.inicioAt}
        finAt={ejecucion.finAt}
        errorMsg={ejecucion.errorMsg}
      />

      <PasosList ejecucionId={params.id} initialPasos={ejecucion.pasos.map(p => ({
        id: p.id,
        numero: p.numero,
        descripcion: p.descripcion,
        estado: p.estado,
        duracionMs: p.duracionMs,
        selfHealed: p.selfHealed,
        errorMsg: p.errorMsg,
        createdAt: p.createdAt.toISOString(),
      }))} />
    </div>
  )
}
