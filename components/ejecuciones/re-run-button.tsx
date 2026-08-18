'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dispararEjecucion } from '@/lib/ejecuciones/actions'

interface ReRunButtonProps {
  casoPruebaId: string
}

export function ReRunButton({ casoPruebaId }: ReRunButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleReRun() {
    setLoading(true)
    try {
      const result = await dispararEjecucion(casoPruebaId)
      if (result.id) {
        router.push(`/ejecuciones/${result.id}`)
      }
    } catch (error) {
      console.error('[ReRunButton] Error:', error)
      alert(error instanceof Error ? error.message : 'Error al re-ejecutar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      className="btn"
      onClick={handleReRun}
      disabled={loading}
      title="Volver a ejecutar este caso de prueba"
    >
      {loading ? 'Lanzando…' : 'Volver a ejecutar'}
    </button>
  )
}
