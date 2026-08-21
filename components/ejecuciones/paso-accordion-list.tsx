'use client'

import { useState, useEffect, useCallback } from 'react'
import { PasoAccordionItem } from './paso-accordion-item'

interface Subaccion {
  id: string
  numero: number
  descripcion: string
  estado: string
  duracionMs: number | null
  tipo: string
  errorMsg: string | null
  logs: unknown
  capturaActual?: { id: string; tipo: string; nombre: string; bytes: number } | null
  capturaReferencia?: { id: string; tipo: string; nombre: string; bytes: number } | null
}

interface Paso {
  id: string
  numero: number
  descripcion: string
  estado: string
  duracionMs: number | null
  selfHealed: boolean
  errorMsg: string | null
  resultadoEsperado: string | null
  resultadoObtenido: string | null
  errorCount: number
  logs: unknown
  createdAt: string
  subacciones: Subaccion[]
}

interface Props {
  pasos: Paso[]
  defaultExpandedId?: string | null
  onExpandedChange?: (pasoId: string | null) => void
}

function computeDefaultExpandedId(pasos: Paso[]): string | null {
  const firstFailed = pasos.find((p) => p.estado === 'fallo')
  if (firstFailed) return firstFailed.id
  return pasos[0]?.id ?? null
}

export function PasoAccordionList({ pasos, defaultExpandedId, onExpandedChange }: Props) {
  const [expandedPasoId, setExpandedPasoId] = useState<string | null>(
    defaultExpandedId ?? computeDefaultExpandedId(pasos)
  )
  const [expandedSubaccionId, setExpandedSubaccionId] = useState<string | null>(null)

  useEffect(() => {
    if (defaultExpandedId != null) {
      setExpandedPasoId(defaultExpandedId)
    }
  }, [defaultExpandedId])

  const handleTogglePaso = useCallback((pasoId: string) => {
    setExpandedPasoId((prev) => {
      const next = prev === pasoId ? null : pasoId
      onExpandedChange?.(next)
      return next
    })
    // No resetear expandedSubaccionId: el estado del sub-paso se preserva
    // entre toggle del paso padre.
  }, [onExpandedChange])

  const handleToggleSubaccion = useCallback((subId: string) => {
    setExpandedSubaccionId((prev) => (prev === subId ? null : subId))
  }, [])

  return (
    <div className="flex flex-col" data-purpose="steps-list">
      {pasos.map((paso) => (
        <PasoAccordionItem
          key={paso.id}
          paso={paso}
          expanded={expandedPasoId === paso.id}
          onToggle={() => handleTogglePaso(paso.id)}
          expandedSubaccionId={expandedSubaccionId}
          onToggleSubaccion={handleToggleSubaccion}
        />
      ))}
    </div>
  )
}
