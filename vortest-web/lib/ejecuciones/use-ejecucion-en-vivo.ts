'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { estaEnCurso } from './estado'

export type EstadoConexion = 'ok' | 'reintentando' | 'sesion-vencida'

const INTERVALO_MS = 2000
const ESPERA_MAXIMA_MS = 30000

/**
 * Refresca la ejecución mientras está en cola o corriendo y se detiene sola al terminar.
 * Pausa con la pestaña oculta y espera más entre reintentos cuando el servidor no responde.
 */
export function useEjecucionEnVivo<T extends { estado: string }>(ejecucionId: string, inicial: T) {
  const [ejecucion, setEjecucion] = useState<T>(inicial)
  const [conexion, setConexion] = useState<EstadoConexion>('ok')
  // Cambiar este número reinicia el ciclo (p. ej. después de detener la ejecución).
  const [reinicio, setReinicio] = useState(0)
  const enCurso = useRef(estaEnCurso(inicial.estado))

  useEffect(() => {
    let cancelado = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let fallos = 0

    async function consultar(): Promise<boolean> {
      try {
        const res = await fetch(`/api/ejecuciones/${ejecucionId}`, { cache: 'no-store' })
        if (res.status === 401) {
          if (!cancelado) setConexion('sesion-vencida')
          return false
        }
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as T
        fallos = 0
        if (!cancelado) {
          setConexion('ok')
          setEjecucion(data)
        }
        return estaEnCurso(data.estado)
      } catch {
        fallos += 1
        if (fallos >= 2 && !cancelado) setConexion('reintentando')
        return true
      }
    }

    function programar() {
      if (timer) clearTimeout(timer)
      if (cancelado || !enCurso.current || document.hidden) return
      const espera = fallos === 0 ? INTERVALO_MS : Math.min(INTERVALO_MS * 2 ** fallos, ESPERA_MAXIMA_MS)
      timer = setTimeout(async () => {
        enCurso.current = await consultar()
        programar()
      }, espera)
    }

    function alCambiarVisibilidad() {
      if (document.hidden || !enCurso.current) return
      void consultar().then((sigue) => {
        enCurso.current = sigue
        programar()
      })
    }

    if (reinicio > 0) {
      void consultar().then((sigue) => {
        enCurso.current = sigue
        programar()
      })
    } else {
      programar()
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      cancelado = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [ejecucionId, reinicio])

  /** Fuerza una consulta (p. ej. tras detener) y reanuda el seguimiento si sigue en curso. */
  const refrescar = useCallback(() => setReinicio((n) => n + 1), [])

  return { ejecucion, conexion, refrescar }
}
