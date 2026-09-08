interface Props {
  total: number
  ok: number
  fail: number
}

export function AsercionesResumen({ total, ok, fail }: Props) {
  const empty = total === 0

  return (
    <div className="flex items-center gap-4">
      <div className="flex flex-1 flex-col gap-1 rounded border border-m3-outline-variant bg-m3-surface-container p-2 text-center">
        <span className="font-headline text-2xl font-bold text-m3-on-surface">{empty ? '—' : total}</span>
        <span className="font-label text-[10px] uppercase text-m3-on-surface-variant">Total</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 rounded border border-m3-tertiary-container/40 bg-m3-tertiary-container/15 p-2 text-center">
        <span className="font-headline text-2xl font-bold text-m3-on-tertiary-container">{empty ? '—' : ok}</span>
        <span className="font-label text-[10px] uppercase text-m3-on-tertiary-container">Exitosas</span>
      </div>
      <div className="flex flex-1 flex-col gap-1 rounded border border-m3-error/30 bg-m3-error-container/15 p-2 text-center">
        <span className="font-headline text-2xl font-bold text-m3-error">{empty ? '—' : fail}</span>
        <span className="font-label text-[10px] uppercase text-m3-error">Fallidas</span>
      </div>
    </div>
  )
}
