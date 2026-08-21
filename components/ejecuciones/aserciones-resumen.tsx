interface Props {
  total: number
  ok: number
  fail: number
}

export function AsercionesResumen({ total, ok, fail }: Props) {
  const empty = total === 0

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1 flex flex-col gap-1 text-center bg-gray-50 p-2 rounded border border-gray-200">
        <span className="text-2xl font-bold text-gray-900">{empty ? '—' : total}</span>
        <span className="text-[10px] text-gray-500 uppercase">Total</span>
      </div>
      <div className="flex-1 flex flex-col gap-1 text-center bg-green-50 p-2 rounded border border-green-100">
        <span className="text-2xl font-bold text-green-600">{empty ? '—' : ok}</span>
        <span className="text-[10px] text-green-700 uppercase">Exitosas</span>
      </div>
      <div className="flex-1 flex flex-col gap-1 text-center bg-red-50 p-2 rounded border border-red-100">
        <span className="text-2xl font-bold text-red-600">{empty ? '—' : fail}</span>
        <span className="text-[10px] text-red-700 uppercase">Fallidas</span>
      </div>
    </div>
  )
}
