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
  pasos: Paso[]
}

export function PasosList({ ejecucionId, pasos }: Props) {
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  const prevPasosRef = useRef<Paso[]>(pasos)

  useEffect(() => {
    const prevMap = new Map(prevPasosRef.current.map(p => [p.id, p]))
    const added = pasos.filter(p => !prevMap.has(p.id))
    const updated = pasos.filter(p => {
      const prev = prevMap.get(p.id)
      if (!prev) return false
      return (
        prev.estado !== p.estado ||
        prev.duracionMs !== p.duracionMs ||
        prev.errorMsg !== p.errorMsg ||
        prev.selfHealed !== p.selfHealed ||
        prev.descripcion !== p.descripcion
      )
    })

    const changedIds = [...added.map(p => p.id), ...updated.map(p => p.id)]

    if (changedIds.length > 0) {
      setFreshIds(prev => {
        const next = new Set([...prev, ...changedIds])
        return next
      })

      setTimeout(() => {
        setFreshIds(prev => {
          const next = new Set(prev)
          changedIds.forEach(id => next.delete(id))
          return next
        })
      }, 3000)
    }

    prevPasosRef.current = pasos
  }, [pasos])

  if (pasos.length === 0) {
    return (
      <div className="card p-6 text-center text-ink-3">
        Aún no hay pasos registrados.
      </div>
    )
  }

  return (
    <div className="ledger">
      {pasos.map(paso => {
        const isFresh = freshIds.has(paso.id)
        const failClass = paso.estado === 'fallo' ? 'fail' : ''
        const healClass = paso.estado === 'reparado' || paso.selfHealed ? 'heal' : ''
        const pillVariant =
          paso.estado === 'fallo'
            ? 'p-fail'
            : paso.estado === 'reparado' || paso.selfHealed
              ? 'p-heal'
              : paso.estado === 'errorMotor'
                ? 'p-idle'
                : 'p-pass'
        return (
          <div
            key={paso.id}
            data-testid={`paso-${paso.numero}`}
            data-fresh={isFresh}
            data-estado={paso.estado}
            className={`rstep${failClass ? ` ${failClass}` : ''}${healClass ? ` ${healClass}` : ''}${isFresh ? ' new' : ''}`}
          >
            <div className="no">
              {paso.numero.toString().padStart(2, '0')}
            </div>
            <div>
              <div className="desc">{paso.descripcion}</div>
              {paso.errorMsg && (
                <div className="desc-meta" style={{ color: 'var(--stamp)' }}>
                  {paso.errorMsg}
                </div>
              )}
              {paso.selfHealed && (
                <div className="desc-meta" style={{ color: 'var(--amber)' }}>
                  reparado — el selector principal cambió, se usó el respaldo
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className={`pill ${pillVariant}`}>
                {paso.estado === 'paso'
                  ? 'Conforme'
                  : paso.estado === 'fallo'
                    ? 'No conforme'
                    : paso.estado === 'reparado'
                      ? 'Reparado'
                      : paso.estado === 'errorMotor'
                        ? 'Error motor'
                        : paso.estado}
              </span>
              <span className="dur">
                {paso.duracionMs != null ? `${(paso.duracionMs / 1000).toFixed(1)}s` : '—'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
