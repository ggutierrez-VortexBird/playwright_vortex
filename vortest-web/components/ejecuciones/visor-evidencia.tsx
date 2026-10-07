'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Icon } from '@/components/ui/icon'
import { buttonClassName } from '@/components/ui/button'

interface VisorEvidenciaProps {
  src: string
  alt: string
  /** Título del visor, p. ej. "Captura actual · paso 3". */
  titulo: string
  className?: string
}

/** Miniatura completa (sin recortes) que abre la captura a tamaño real, con zoom y descarga. */
export function VisorEvidencia({ src, alt, titulo, className }: VisorEvidenciaProps) {
  const [abierto, setAbierto] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'error'>('cargando')

  if (estado === 'error') {
    return (
      <div className={cn('flex aspect-video items-center justify-center gap-2 rounded-md border border-dashed border-m3-outline-variant bg-m3-surface-container font-body text-body-xs text-m3-on-surface-variant', className)}>
        <Icon name="image_not_supported" size={18} />
        Evidencia no disponible
      </div>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Ampliar: ${titulo}`}
        className={cn(
          'group relative block aspect-video w-full overflow-hidden rounded-md border border-m3-outline-variant bg-m3-surface-container-high transition-shadow duration-fast ease-standard hover:shadow-card-hover',
          estado === 'cargando' && 'animate-pulse',
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- artefacto autenticado servido por la API, no optimizable por next/image */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setEstado('ok')}
          onError={() => setEstado('error')}
          className="h-full w-full object-contain"
        />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm bg-m3-scrim/70 px-1.5 py-0.5 font-label text-label-xs text-white opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100">
          <Icon name="zoom_in" size={14} />
          Ampliar
        </span>
      </button>

      <Modal open={abierto} onClose={() => { setAbierto(false); setZoom(false) }} labelledBy="visor-evidencia-titulo" className="max-w-6xl">
        <div className="flex items-center justify-between gap-3 border-b border-m3-outline-variant px-4 py-3">
          <h2 id="visor-evidencia-titulo" className="truncate font-headline text-headline-sm text-m3-on-surface">{titulo}</h2>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setZoom((z) => !z)} className={buttonClassName({ variant: 'ghost' })} aria-pressed={zoom} aria-label={zoom ? 'Ajustar a la pantalla' : 'Ver a tamaño real'}>
              <Icon name={zoom ? 'zoom_out' : 'zoom_in'} />
            </button>
            <a href={src} download className={buttonClassName({ variant: 'ghost' })} aria-label="Descargar captura">
              <Icon name="download" />
            </a>
            <button type="button" onClick={() => { setAbierto(false); setZoom(false) }} className={buttonClassName({ variant: 'ghost' })} aria-label="Cerrar visor">
              <Icon name="close" />
            </button>
          </div>
        </div>
        <div className={cn('bg-m3-surface-container-high', zoom ? 'max-h-[75vh] overflow-auto' : 'flex items-center justify-center p-4')}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ver arriba */}
          <img
            src={src}
            alt={alt}
            onClick={() => setZoom((z) => !z)}
            className={cn(zoom ? 'max-w-none cursor-zoom-out' : 'max-h-[70vh] w-auto cursor-zoom-in object-contain')}
          />
        </div>
      </Modal>
    </>
  )
}
