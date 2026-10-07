'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dispararEjecucion } from '@/lib/ejecuciones/actions'

interface ReRunButtonProps {
  casoPruebaId: string
}

export function ReRunButton({ casoPruebaId }: ReRunButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleReRun() {
    setLoading(true)
    setError(null)
    try {
      const result = await dispararEjecucion(casoPruebaId)
      if (result.id) {
        router.push(`/ejecuciones/${result.id}`)
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Error al re-ejecutar',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="rounded border border-m3-outline-variant px-4 py-2 font-label text-label-md text-m3-on-surface hover:bg-m3-surface-container-high transition-colors"
        onClick={handleReRun}
        disabled={loading}
        title="Volver a ejecutar este caso de prueba"
      >
        {loading ? 'Lanzando…' : 'Volver a ejecutar'}
      </button>
      {error && (
        <span className="font-mono text-label-xs text-m3-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
