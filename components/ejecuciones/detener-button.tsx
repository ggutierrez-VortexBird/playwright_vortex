'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  ejecucionId: string
  /** Estados donde el botón está visible */
  visible: boolean
}

/**
 * Botón para detener una ejecución activa (pendiente o corriendo).
 *
 * Decisiones de producto:
 * - Cancelación dura: mata el proceso Playwright vía SIGTERM en el worker.
 * - Confirm dialog antes de enviar (defensa contra clicks accidentales).
 * - Refresca el server component al éxito para que el estado nuevo
 *   (cancelado) se refleje sin recarga completa.
 * - Mensajes de error específicos según el código HTTP de respuesta.
 */
export function DetenerButton({ ejecucionId, visible }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!visible) return null

  async function handleDetener() {
    if (
      !confirm(
        '¿Detener la ejecución? Los pasos ya completados se conservan.'
      )
    ) {
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}/detener`, {
        method: 'POST',
      })
      if (res.ok) {
        router.refresh()
      } else if (res.status === 409) {
        setError('La ejecución ya terminó')
      } else if (res.status === 403) {
        setError('Sin permisos')
      } else if (res.status === 404) {
        setError('No encontrada')
      } else {
        setError('Error al detener')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDetener}
        disabled={submitting}
        aria-label="Detener ejecución"
        className="btn btn-stop"
      >
        {submitting ? '⏳ Deteniendo…' : '■ Detener'}
      </button>
      {error && (
        <span className="font-mono text-[10px] text-stamp">{error}</span>
      )}
    </div>
  )
}
