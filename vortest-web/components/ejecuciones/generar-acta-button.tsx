'use client'

import { useState } from 'react'
import { Button, buttonClassName } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { useToast } from '@/components/ui/toast'

interface Acta {
  id: string
  consecutivo: string
  pdfPath: string
  downloadUrl: string
}

interface Props {
  ejecucionId: string
  /** Acta ya generada (si existe): se muestra directo el enlace para abrirla. */
  initialActa?: Acta | null
}

/** HU-G19 — Genera el acta de evidencia (PDF) y la deja a un clic; si ya existe, enlaza directo. */
export function GenerarActaButton({ ejecucionId, initialActa }: Props) {
  const toast = useToast()
  const [acta, setActa] = useState<Acta | null>(initialActa ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerar() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}/acta`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `El servidor respondió ${res.status}`)
      }
      const data = (await res.json()) as Acta & { ok: boolean }
      const nueva = { id: data.id, consecutivo: data.consecutivo, pdfPath: data.pdfPath, downloadUrl: data.downloadUrl }
      setActa(nueva)
      toast({
        tone: 'success',
        title: `Acta ${nueva.consecutivo} lista`,
        action: { label: 'Abrir acta', href: nueva.downloadUrl },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el acta')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1" data-testid="generar-acta-wrap">
      {acta ? (
        <a
          href={acta.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="acta-download-link"
          className={buttonClassName({ variant: 'primary' })}
          title="Abre el PDF en una pestaña nueva"
        >
          <Icon name="picture_as_pdf" size={18} />
          Acta {acta.consecutivo}
        </a>
      ) : (
        <Button
          variant="primary"
          icon="picture_as_pdf"
          onClick={handleGenerar}
          loading={busy}
          loadingText="Generando acta…"
          data-testid="generar-acta-button"
        >
          Generar acta de evidencia
        </Button>
      )}
      {error && (
        <span role="alert" data-testid="generar-acta-error" className="max-w-xs text-right font-body text-body-xs text-m3-error">
          No se pudo generar el acta: {error}
        </span>
      )}
    </div>
  )
}
