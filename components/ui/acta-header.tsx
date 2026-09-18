'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface ActaHeaderData {
  id: string
  numero: string
  casoId: string
  ambiente: string
  ejecutadoPor: string
  inicio: Date
  fin: Date
  hashSha256?: string
}

interface ActaHeaderProps {
  acta: ActaHeaderData
  onCopyHash?: () => void
  className?: string
}

function formatDate(date: Date): string {
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(inicio: Date, fin: Date): string {
  const diffMs = fin.getTime() - inicio.getTime()
  if (diffMs < 0) return '—'
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const remainingSecs = secs % 60
  if (mins < 60) return `${mins}m ${remainingSecs}s`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return `${hours}h ${remainingMins}m`
}

/**
 * ActaHeader — Signature Component #2
 *
 * Header del documento "Acta" con metadatos criticos:
 * ID (EJC-####), REQ-####, ambiente, ejecutado por, fecha, hash SHA-256.
 *
 * Anatomia:
 *   - Bloque con borde-left m3-tertiary (3px) para hacerlo notar
 *   - Grid de 2 columnas para metadata
 *   - SHA-256 en JetBrains Mono con boton "copiar"
 *   - Numero de acta prominente (Archivo 700, 20px)
 *
 * Tokens M3: m3-outline-variant, m3-surface-container-lowest, m3-on-surface-variant
 *
 * Impeccable: typeset + craft + harden
 */
export function ActaHeader({ acta, onCopyHash, className }: ActaHeaderProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopyHash() {
    if (!acta.hashSha256) return
    try {
      await navigator.clipboard.writeText(acta.hashSha256)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      onCopyHash?.()
    } catch {
      // clipboard not available
    }
  }

  return (
    <div
      className={cn(
        'rounded-lg border-l-[3px] border border-m3-outline-variant',
        'bg-m3-surface-container-lowest p-5',
        'border-l-m3-tertiary',
        className
      )}
      role="region"
      aria-label="Acta de ejecucion"
    >
      {/* Header row: Acta ID + status badges */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-headline text-headline-md text-m3-on-surface">
            Acta {acta.numero}
          </h2>
          <span className="inline-flex items-center rounded-full bg-m3-tertiary-container px-2.5 py-0.5 font-label text-label-xs font-medium text-m3-on-tertiary-container">
            {acta.ambiente}
          </span>
        </div>
      </div>

      {/* Metadata grid */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="font-label text-label-xs font-medium text-m3-on-surface-variant uppercase tracking-wide">
            Caso
          </dt>
          <dd className="mt-0.5 font-mono-code text-mono-code text-body-sm text-m3-on-surface">
            {acta.casoId}
          </dd>
        </div>

        <div>
          <dt className="font-label text-label-xs font-medium text-m3-on-surface-variant uppercase tracking-wide">
            Ejecutado por
          </dt>
          <dd className="mt-0.5 font-body text-body-sm text-m3-on-surface">
            {acta.ejecutadoPor}
          </dd>
        </div>

        <div>
          <dt className="font-label text-label-xs font-medium text-m3-on-surface-variant uppercase tracking-wide">
            Inicio
          </dt>
          <dd className="mt-0.5 font-body text-body-sm text-m3-on-surface">
            {formatDate(acta.inicio)}
          </dd>
        </div>

        <div>
          <dt className="font-label text-label-xs font-medium text-m3-on-surface-variant uppercase tracking-wide">
            Duracion
          </dt>
          <dd className="mt-0.5 font-body text-body-sm text-m3-on-surface">
            {formatDuration(acta.inicio, acta.fin)}
          </dd>
        </div>
      </dl>

      {/* SHA-256 hash */}
      {acta.hashSha256 && (
        <div className="mt-4 pt-4 border-t border-m3-outline-variant">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <dt className="font-label text-label-xs font-medium text-m3-on-surface-variant uppercase tracking-wide">
                SHA-256
              </dt>
              <dd className="mt-0.5 truncate font-mono-code text-mono-code text-body-sm text-m3-on-surface-variant">
                {acta.hashSha256}
              </dd>
            </div>
            <button
              type="button"
              onClick={handleCopyHash}
              className="shrink-0 rounded-lg border border-m3-outline-variant px-3 py-1.5 font-label text-label-sm text-m3-on-surface-variant transition hover:border-m3-primary hover:text-m3-primary disabled:opacity-50"
              aria-label="Copiar hash SHA-256"
              title="Copiar hash"
            >
              {copied ? (
                <span className="flex items-center gap-1.5 text-m3-tertiary">
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  Copiado
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  Copiar
                </span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
