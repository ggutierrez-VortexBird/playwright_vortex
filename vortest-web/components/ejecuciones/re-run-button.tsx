'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { dispararEjecucion } from '@/lib/ejecuciones/actions'

interface ReRunButtonProps {
  casoPruebaId: string
}

const MENSAJES: Record<string, string> = {
  YA_EXISTE_EJECUCION_EN_CURSO: 'Este caso ya tiene una ejecución en curso.',
  NOT_FOUND: 'El caso ya no existe.',
  FORBIDDEN: 'No tienes permiso para ejecutar este caso.',
}

// En producción Next reemplaza el mensaje de los errores de Server Actions por un texto genérico en inglés.
function mensajeDeError(e: unknown): string {
  const m = e instanceof Error ? e.message : ''
  if (MENSAJES[m]) return MENSAJES[m]
  if (!m || /Server Components? render|digest/i.test(m)) return 'No se pudo lanzar la ejecución. Intenta de nuevo.'
  return m
}

export function ReRunButton({ casoPruebaId }: ReRunButtonProps) {
  const router = useRouter()
  const enVuelo = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReRun() {
    if (enVuelo.current) return
    enVuelo.current = true
    setLoading(true)
    setError(null)
    try {
      const result = await dispararEjecucion(casoPruebaId)
      if (result.id) {
        router.push(`/ejecuciones/${result.id}`)
        return
      }
    } catch (e: unknown) {
      setError(mensajeDeError(e))
    }
    enVuelo.current = false
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        icon="replay"
        onClick={handleReRun}
        loading={loading}
        loadingText="Lanzando…"
        title="Volver a ejecutar este caso de prueba"
      >
        Volver a ejecutar
      </Button>
      {error && (
        <span className="max-w-xs text-right font-body text-body-xs text-m3-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
