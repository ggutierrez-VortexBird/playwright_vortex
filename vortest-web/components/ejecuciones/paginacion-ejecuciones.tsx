import Link from 'next/link'

interface PaginacionEjecucionesProps {
  paginaActual: number
  totalPaginas: number
  total: number
  q?: string
  estado?: string
}

function urlPagina(pagina: number, q?: string, estado?: string) {
  const params = new URLSearchParams()
  if (pagina > 1) params.set('page', String(pagina))
  if (q) params.set('q', q)
  if (estado) params.set('estado', estado)
  const qs = params.toString()
  return `/ejecuciones${qs ? `?${qs}` : ''}`
}

/** Páginas visibles: primera, última y dos alrededor de la actual; `null` marca un salto. */
function paginasVisibles(actual: number, total: number): (number | null)[] {
  const set = new Set([1, total, actual - 2, actual - 1, actual, actual + 1, actual + 2])
  const ordenadas = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)
  const resultado: (number | null)[] = []
  ordenadas.forEach((p, i) => {
    if (i > 0 && p - ordenadas[i - 1] > 1) resultado.push(null)
    resultado.push(p)
  })
  return resultado
}

const base =
  'inline-flex min-w-9 items-center justify-center rounded-md border px-3 py-1.5 font-label text-label-sm font-semibold transition-colors'
const normal = `${base} border-m3-outline-variant text-m3-on-surface hover:bg-m3-surface-container-high`
const deshabilitado = `${base} pointer-events-none border-m3-outline-variant text-m3-on-surface opacity-50`

export function PaginacionEjecuciones({ paginaActual, totalPaginas, total, q, estado }: PaginacionEjecucionesProps) {
  if (totalPaginas <= 1) return null
  return (
    <nav
      aria-label="Paginación de ejecuciones"
      className="flex flex-col items-center justify-between gap-4 rounded-md border border-m3-outline-variant bg-m3-surface-container px-5 py-3 sm:flex-row"
    >
      <p className="font-label text-label-xs text-m3-on-surface-variant">
        Página <span className="font-semibold text-m3-on-surface">{paginaActual}</span> de{' '}
        <span className="font-semibold text-m3-on-surface">{totalPaginas}</span> · {total} ejecuciones
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {paginaActual > 1 ? (
          <Link href={urlPagina(paginaActual - 1, q, estado)} className={normal}>Anterior</Link>
        ) : (
          <span aria-disabled="true" className={deshabilitado}>Anterior</span>
        )}
        {paginasVisibles(paginaActual, totalPaginas).map((p, i) =>
          p === null ? (
            <span key={`salto-${i}`} className="px-1 text-m3-on-surface-variant" aria-hidden="true">…</span>
          ) : p === paginaActual ? (
            <span
              key={p}
              aria-current="page"
              className={`${base} border-m3-info bg-m3-info-container text-m3-info`}
            >
              {p}
            </span>
          ) : (
            <Link key={p} href={urlPagina(p, q, estado)} className={normal} aria-label={`Ir a la página ${p}`}>
              {p}
            </Link>
          )
        )}
        {paginaActual < totalPaginas ? (
          <Link href={urlPagina(paginaActual + 1, q, estado)} className={normal}>Siguiente</Link>
        ) : (
          <span aria-disabled="true" className={deshabilitado}>Siguiente</span>
        )}
      </div>
    </nav>
  )
}
