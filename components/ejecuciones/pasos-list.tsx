'use client'

import { useState, useEffect, useRef } from 'react'

interface Paso {
  id: string
  numero: number
  descripcion: string
  estado: string
  duracionMs: number | null
  selfHealed: boolean
  errorMsg: string | null
  createdAt: string
}

interface Props {
  ejecucionId: string
  initialPasos: Paso[]
}

export function PasosList({ ejecucionId, initialPasos }: Props) {
  const [pasos, setPasos] = useState<Paso[]>(initialPasos)
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  const prevPasosRef = useRef<Paso[]>(initialPasos)

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ejecuciones/${ejecucionId}`)
        const data = await res.json()
        const newPasos: Paso[] = data.pasos ?? []

        const prevIds = new Set(prevPasosRef.current.map(p => p.id))
        const added = newPasos.filter(p => !prevIds.has(p.id))

        if (added.length > 0) {
          setFreshIds(prev => {
            const next = new Set([...prev, ...added.map(p => p.id)])
            return next
          })

          setTimeout(() => {
            setFreshIds(prev => {
              const next = new Set(prev)
              added.forEach(p => next.delete(p.id))
              return next
            })
          }, 2000)
        }

        setPasos(newPasos)
        prevPasosRef.current = newPasos
      } catch {
        // ignore polling errors
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [ejecucionId])

  return (
    <div className="space-y-2">
      {pasos.map(paso => (
        <div
          key={paso.id}
          className={`
            flex items-center gap-3 p-3 border rounded
            ${freshIds.has(paso.id) ? 'step step-fresh' : 'step'}
            ${paso.estado === 'fallo' ? 'border-[--stamp]' : ''}
            ${paso.estado === 'reparado' ? 'border-[--amber]' : ''}
          `}
        >
          <span className="font-mono text-xs text-[--rule]">#{paso.numero}</span>
          <span className="flex-1 text-sm">{paso.descripcion}</span>
          <span className={`pill pill-${paso.estado === 'paso' ? 'pass' : paso.estado}`}>
            {paso.estado}
          </span>
          {paso.selfHealed && <span className="pill pill-heal">heal</span>}
          {paso.duracionMs && (
            <span className="font-mono text-xs text-[--rule]">{paso.duracionMs}ms</span>
          )}
        </div>
      ))}
    </div>
  )
}
