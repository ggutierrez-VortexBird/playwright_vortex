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
  const fallos = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activo = useRef(estaEnCurso(inicial.estado))

  const consultar = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}`, { cache: 'no-store' })
      if (res.status === 401) {
        setConexion('sesion-vencida')
        return false
      }
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as T
      fallos.current = 0
      setConexion('ok')
      setEjecucion(data)
      return estaEnCurso(data.estado)
    } catch {
      fallos.current += 1
      if (fallos.current >= 2) setConexion('reintentando')
      return true
    }
  }, [ejecucionId])

  const programar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!activo.current || document.hidden) return
    const espera = fallos.current === 0 ? INTERVALO_MS : Math.min(INTERVALO_MS * 2 ** fallos.current, ESPERA_MAXIMA_MS)
    timer.current = setTimeout(async () => {
      activo.current = await consultar()
      programar()
    }, espera)
  }, [consultar])

  useEffect(() => {
    programar()
    function alCambiarVisibilidad() {
      if (document.hidden || !activo.current) return
      void consultar().then((sigue) => {
        activo.current = sigue
        programar()
      })
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      if (timer.current) clearTimeout(timer.current)
    }
  }, [consultar, programar])

  /** Fuerza una consulta (p. ej. tras detener) y reanuda el seguimiento si sigue en curso. */
  const refrescar = useCallback(async () => {
    activo.current = await consultar()
    programar()
  }, [consultar, programar])

  return { ejecucion, conexion, refrescar }
}
