'use client'

import { useCallback, useRef, useState } from 'react'
import { useToast } from '@/components/ui/toast'

const MENSAJES: Record<string, string> = {
  ejecucion_en_curso: 'Este caso ya tiene una ejecución en curso.',
  caso_inactivo: 'El caso está inactivo. Actívalo para poder ejecutarlo.',
  not_found: 'El caso ya no existe.',
  forbidden: 'No tienes permiso para ejecutar este caso.',
  'Sin permisos': 'No tienes permiso para ejecutar este caso.',
}

export interface ErrorDeLanzamiento {
  mensaje: string
  /** Si el caso ya tenía una ejecución en curso, su id para ofrecer ir a verla. */
  ejecucionEnCursoId?: string
}

/**
 * Lanza un caso por la ruta HTTP única y navega al detalle; el ref queda tomado hasta salir de la página,
 * así un doble clic no lanza dos veces. Con `inline` el error se devuelve para mostrarlo en la pantalla en vez de un toast.
 */
export function useLanzarEjecucion({ inline = false }: { inline?: boolean } = {}) {
  const toast = useToast()
  const enVuelo = useRef(false)
  const [lanzando, setLanzando] = useState(false)
  const [error, setError] = useState<ErrorDeLanzamiento | null>(null)

  const lanzar = useCallback(
    async (casoId: string) => {
      if (enVuelo.current) return
      enVuelo.current = true
      setLanzando(true)
      setError(null)
      let fallo: ErrorDeLanzamiento
      try {
        const res = await fetch(`/api/casos/${encodeURIComponent(casoId)}/ejecutar`, { method: 'POST' })
        const data = (await res.json().catch(() => ({}))) as { ejecucionId?: string; error?: string; message?: string }
        if (res.ok && data.ejecucionId) {
          toast({ tone: 'info', title: 'Ejecución en cola', description: 'Te avisamos cuando termine.' })
          window.location.href = `/ejecuciones/${data.ejecucionId}`
          return
        }
        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        fallo = {
          mensaje: MENSAJES[data.error ?? ''] ?? data.message ?? `El servidor respondió ${res.status}. Intenta de nuevo.`,
          ejecucionEnCursoId: data.error === 'ejecucion_en_curso' ? data.ejecucionId : undefined,
        }
      } catch {
        fallo = { mensaje: 'Sin conexión con el servidor. Revisa tu conexión e intenta de nuevo.' }
      }
      if (inline) setError(fallo)
      else
        toast({
          tone: fallo.ejecucionEnCursoId ? 'warning' : 'error',
          title: 'No se pudo ejecutar',
          description: fallo.mensaje,
          action: fallo.ejecucionEnCursoId ? { label: 'Ver ejecución en curso', href: `/ejecuciones/${fallo.ejecucionEnCursoId}` } : undefined,
        })
      enVuelo.current = false
      setLanzando(false)
    },
    [toast, inline],
  )

  return { lanzar, lanzando, error }
}
