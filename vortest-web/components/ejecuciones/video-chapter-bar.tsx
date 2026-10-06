'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  computeChapterSegments,
  findChapterAtTime,
  type ChapterSegment,
  type PasoConCapitulo,
} from '@/lib/ejecuciones/chapter-segments'

interface Props {
  /** Pasos de la ejecución con timestamps opcionales. */
  pasos: PasoConCapitulo[]
  /** Duración total del video en ms (provista por el <video>). */
  videoDurationMs: number
  /** Ref al elemento <video> (necesario para seek). */
  videoRef: React.RefObject<HTMLVideoElement | null>
}

/**
 * HU-G18 — barra segmentada de capítulos del video.
 *
 *   - Click en un segmento → seek del <video> al inicio del capítulo.
 *   - Resalta el capítulo activo mientras el video reproduce.
 *   - Overlay "Paso N · descripción" arriba del player.
 *
 * Si los pasos no tienen timestamps válidos, caemos al fallback por
 * `duracionMs` (chapter-segments.ts).
 */
export function VideoChapterBar({ pasos, videoDurationMs, videoRef }: Props) {
  const [segments, setSegments] = useState<ChapterSegment[]>([])
  const [activeChapterSegment, setActiveChapterSegment] = useState<ChapterSegment | null>(null)
  const rafRef = useRef<number | null>(null)

  // Recompute segments whenever the steps or the video duration change.
  useEffect(() => {
    const next = computeChapterSegments(pasos, videoDurationMs)
    setSegments(next)
    setActiveChapterSegment(null)
  }, [pasos, videoDurationMs])

  // Track the current playhead via requestAnimationFrame for smoothness.
  const updateActive = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const t = v.currentTime * 1000
    setActiveChapterSegment((prev) => {
      const found = findChapterAtTime(segments, t)
      if (!prev && !found) return prev
      if (prev && found && prev.pasoId === found.pasoId) return prev
      return found
    })
    rafRef.current = requestAnimationFrame(updateActive)
  }, [segments, videoRef])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateActive)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [updateActive])

  const handleClickSegment = useCallback(
    (seg: ChapterSegment) => {
      const v = videoRef.current
      if (!v) return
      v.currentTime = Math.max(0, seg.inicioMs / 1000)
      v.play().catch(() => {
        // ignore play() promise rejection (e.g., user hasn't interacted yet)
      })
      setActiveChapterSegment(seg)
    },
    [videoRef],
  )

  if (segments.length === 0) {
    return null
  }

  return (
    <>
      {/* Overlay: paso activo */}
      <div
        className="video-chapter-overlay"
        data-testid="video-chapter-overlay"
        aria-live="polite"
      >
        {activeChapterSegment
          ? `Paso ${activeChapterSegment.numero} · ${activeChapterSegment.descripcion}`
          : null}
      </div>

      {/* Barra segmentada */}
      <div
        className="bar video-chapter-bar"
        role="group"
        aria-label="Capítulos del video"
        data-testid="video-chapter-bar"
      >
        {segments.map((seg) => {
          const isActive =
            activeChapterSegment?.pasoId === seg.pasoId
          const isFailed = seg.estado === 'fallo'
          return (
            <button
              key={seg.pasoId}
              type="button"
              data-testid="chapter-bar"
              data-paso-id={seg.pasoId}
              data-paso-numero={seg.numero}
              data-active={isActive ? 'true' : 'false'}
              aria-label={`Paso ${seg.numero}: ${seg.descripcion}`}
              className={`chapter ${isFailed ? 'done' : ''} ${
                isActive ? 'active' : ''
              }`}
              style={{ width: `${seg.anchoPct}%` }}
              onClick={() => handleClickSegment(seg)}
            />
          )
        })}
      </div>
    </>
  )
}