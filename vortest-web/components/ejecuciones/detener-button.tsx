'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'

interface Props {
  ejecucionId: string
  /** Estados donde el botón está visible */
  visible: boolean
  /** Se llama tras detener para refrescar la vista sin esperar al próximo ciclo. */
  onDetenida?: () => void
}

const MENSAJES: Record<number, string> = {
  409: 'La ejecución ya había terminado.',
  403: 'No tienes permiso para detener esta ejecución.',
  404: 'La ejecución ya no existe.',
}

/** Detiene una ejecución en cola o en curso; los pasos ya completados se conservan. */
export function DetenerButton({ ejecucionId, visible, onDetenida }: Props) {
  const toast = useToast()
  const [confirmando, setConfirmando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  if (!visible) return null

  async function detener() {
    setEnviando(true)
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}/detener`, { method: 'POST' })
      if (res.ok) {
        toast({ tone: 'neutral', title: 'Ejecución detenida', description: 'Los pasos completados quedan en el detalle.' })
      } else {
        toast({ tone: 'error', title: 'No se pudo detener', description: MENSAJES[res.status] ?? `El servidor respondió ${res.status}.` })
      }
      onDetenida?.()
    } catch {
      toast({ tone: 'error', title: 'Sin conexión con el servidor', description: 'La ejecución sigue en curso. Intenta de nuevo.' })
    } finally {
      setEnviando(false)
      setConfirmando(false)
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" icon="stop_circle" onClick={() => setConfirmando(true)} aria-label="Detener ejecución" className="text-m3-error">
        Detener
      </Button>
      <ConfirmDialog
        open={confirmando}
        icon="stop_circle"
        title="¿Detener la ejecución?"
        description="El navegador se cierra ahora. Los pasos ya completados se conservan y la ejecución queda como cancelada."
        confirmLabel="Detener"
        loadingLabel="Deteniendo…"
        cancelLabel="Seguir ejecutando"
        isLoading={enviando}
        onConfirm={detener}
        onCancel={() => setConfirmando(false)}
      />
    </>
  )
}
