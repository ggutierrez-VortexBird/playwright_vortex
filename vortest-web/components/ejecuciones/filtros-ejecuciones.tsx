'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui/icon'
import { Spinner } from '@/components/ui/spinner'
import { ETIQUETA_FILTRO, FILTROS_ESTADO, type FiltroEstado } from '@/lib/ejecuciones/estado'

interface FiltrosEjecucionesProps {
  /** Conteo por estado de la base (respeta la búsqueda, no el filtro de estado). */
  conteo: Record<string, number>
  q?: string
  estado?: FiltroEstado
}

const ESPERA_BUSQUEDA_MS = 300

export function FiltrosEjecuciones({ conteo, q = '', estado }: FiltrosEjecucionesProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [cargando, startTransition] = useTransition()
  const [texto, setTexto] = useState(q)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => setTexto(q), [q])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function navegar(cambios: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v) sp.set(k, v)
      else sp.delete(k)
    }
    sp.delete('page')
    const qs = sp.toString()
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false }))
  }

  function alEscribir(valor: string) {
    setTexto(valor)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => navegar({ q: valor.trim() || undefined }), ESPERA_BUSQUEDA_MS)
  }

  const contar = (f: FiltroEstado) => FILTROS_ESTADO[f].reduce((s, e) => s + (conteo[e] ?? 0), 0)
  const total = Object.values(conteo).reduce((s, n) => s + n, 0)
  const opciones: { id: FiltroEstado | undefined; label: string; n: number }[] = [
    { id: undefined, label: 'Todas', n: total },
    ...(Object.keys(FILTROS_ESTADO) as FiltroEstado[]).map((f) => ({ id: f, label: ETIQUETA_FILTRO[f], n: contar(f) })),
  ]

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div role="radiogroup" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = o.id === estado
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => navegar({ estado: o.id })}
              disabled={!activo && o.n === 0 && o.id !== undefined}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-label text-label-md transition-colors duration-fast ease-standard disabled:opacity-40',
                activo
                  ? 'border-m3-primary bg-m3-primary text-m3-on-primary'
                  : 'border-m3-outline-variant bg-m3-surface-container-lowest text-m3-on-surface hover:bg-m3-surface-container-high',
              )}
            >
              {o.label}
              <span className={cn('tabular-nums', activo ? 'text-m3-on-primary/80' : 'text-m3-on-surface-variant')}>{o.n}</span>
            </button>
          )
        })}
      </div>
      <div className="relative w-full lg:w-80">
        <label htmlFor="buscar-ejecuciones" className="sr-only">
          Buscar ejecuciones por caso o código
        </label>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-m3-on-surface-variant">
          {cargando ? <Spinner size={18} /> : <Icon name="search" size={18} />}
        </span>
        <input
          id="buscar-ejecuciones"
          type="search"
          value={texto}
          onChange={(e) => alEscribir(e.target.value)}
          placeholder="Buscar por caso o código…"
          className="h-10 w-full rounded-md border border-m3-outline-variant bg-m3-surface-container-lowest pl-10 pr-3 font-body text-body-md text-m3-on-surface placeholder:text-m3-on-surface-variant/70 focus:border-m3-primary focus:outline-none focus:ring-2 focus:ring-m3-primary/25"
        />
      </div>
    </div>
  )
}
