'use client'

import { useEffect, useState } from 'react'

function formatear(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mmss = `${String(m).padStart(h ? 2 : 1, '0')}:${String(s).padStart(2, '0')}`
  return h ? `${h}:${mmss}` : mmss
}

/** Cronómetro en vivo desde `desde`; no se anuncia cada segundo a lectores de pantalla. */
export function TiempoTranscurrido({ desde, className }: { desde: string | Date; className?: string }) {
  const inicio = new Date(desde).getTime()
  const [ahora, setAhora] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <time aria-live="off" dateTime={new Date(inicio).toISOString()} className={className} suppressHydrationWarning>
      {formatear(ahora - inicio)}
    </time>
  )
}
