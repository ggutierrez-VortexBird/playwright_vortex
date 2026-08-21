interface Props {
  entorno: string | null
  navegador: string | null
  sistemaOperativo: string | null
  nodoEjecucion: string | null
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="sm:col-span-1">
      <dt className="text-[11px] font-semibold text-gray-500 uppercase">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{value ?? '—'}</dd>
    </div>
  )
}

export function EntornoDetails({ entorno, navegador, sistemaOperativo, nodoEjecucion }: Props) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
      <Field label="Entorno" value={entorno} />
      <Field label="Navegador" value={navegador} />
      <Field label="Sistema Operativo" value={sistemaOperativo} />
      <Field label="Nodo de Ejecución" value={nodoEjecucion} />
    </dl>
  )
}
