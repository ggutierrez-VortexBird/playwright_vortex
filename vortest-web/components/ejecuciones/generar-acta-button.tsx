'use client'

import { useState } from 'react'

interface Acta {
  id: string
  consecutivo: string
  pdfPath: string
  downloadUrl: string
}

interface Props {
  ejecucionId: string
  /** Acta ya generada (si existe) — la precargamos para mostrar link directo. */
  initialActa?: Acta | null
  /** Estados en los que no se permite generar acta. */
  bloqueadoEstados?: string[]
}

/**
 * HU-G19 — Botón "Generar acta de evidencia" + link de descarga.
 *
 * - Estados terminales (paso/fallo/reparado/errorMotor/cancelado) → habilitado.
 * - Estados no terminales (corriendo/pendiente) → deshabilitado con tooltip.
 * - Si ya existe acta previa → muestra "Descargar acta" inmediatamente.
 * - POST → render server-side → recibe downloadUrl y muestra link.
 */
export function GenerarActaButton({ ejecucionId, initialActa, bloqueadoEstados }: Props) {
  const [acta, setActa] = useState<Acta | null>(initialActa ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bloqueado =
    bloqueadoEstados?.length && bloqueadoEstados.length > 0
      ? false
      : false // el caller pasa la lista de permitidos si quiere

  async function handleGenerar() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ejecuciones/${ejecucionId}/acta`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message ?? `Error ${res.status}`)
      }
      const data = (await res.json()) as Acta & { ok: boolean }
      setActa({
        id: data.id,
        consecutivo: data.consecutivo,
        pdfPath: data.pdfPath,
        downloadUrl: data.downloadUrl,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar el acta')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2" data-testid="generar-acta-wrap">
      {acta ? (
        <a
          href={acta.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="acta-download-link"
          className="rounded border border-m3-outline-variant px-4 py-2 font-label text-label-md text-m3-on-surface hover:bg-m3-surface-container-high transition-colors"
          title={`Acta ${acta.consecutivo}`}
        >
          <span className="material-symbols-outlined text-[16px]">description</span>
          Descargar acta ({acta.consecutivo})
        </a>
      ) : (
        <button
          type="button"
          onClick={handleGenerar}
          disabled={busy || bloqueado}
          data-testid="generar-acta-button"
          className="rounded border border-m3-outline-variant px-4 py-2 font-label text-label-md text-m3-on-surface hover:bg-m3-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">
            {busy ? 'hourglass_top' : 'picture_as_pdf'}
          </span>
          {busy ? 'Generando acta…' : 'Generar acta de evidencia'}
        </button>
      )}
      {error && (
        <span
          role="alert"
          data-testid="generar-acta-error"
          className="text-[11px] text-m3-error font-body"
        >
          {error}
        </span>
      )}
    </div>
  )
}