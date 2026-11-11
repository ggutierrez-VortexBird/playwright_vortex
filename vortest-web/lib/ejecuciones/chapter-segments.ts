// Segmenta el video de una ejecución en capítulos por paso (timestamps del reporter, o proporcional a duracionMs); módulo puro, sin Prisma.

export interface PasoConCapitulo {
  id: string
  numero: number
  descripcion: string
  estado: string
  duracionMs: number | null
  videoInicioMs: number | null
  videoFinMs: number | null
}

export interface ChapterSegment {
  /** ID del paso (para seek/lookup). */
  pasoId: string
  /** Número del paso (1-based). */
  numero: number
  /** Descripción corta del paso para el overlay. */
  descripcion: string
  /** Estado del paso (paso / fallo). */
  estado: string
  /** Offset de inicio en ms desde el inicio del video. */
  inicioMs: number
  /** Offset de fin en ms desde el inicio del video. */
  finMs: number
  /** Ancho como porcentaje del video total (0-100, redondeado). */
  anchoPct: number
}

/** Indica si los pasos tienen timestamps válidos y crecientes para usar capítulos absolutos. */
export function pasosTienenCapitulosValidos(pasos: PasoConCapitulo[]): boolean {
  let lastFin = -1
  for (const p of pasos) {
    if (p.videoInicioMs == null || p.videoFinMs == null) return false
    if (p.videoInicioMs < lastFin) return false
    if (p.videoFinMs < p.videoInicioMs) return false
    lastFin = p.videoFinMs
  }
  return pasos.length > 0
}

/** Calcula los segmentos del chapter bar; devuelve [] si no hay video ni timestamps. */
export function computeChapterSegments(
  pasos: PasoConCapitulo[],
  videoDurationMs: number,
): ChapterSegment[] {
  if (pasos.length === 0) return []

  if (pasosTienenCapitulosValidos(pasos)) {
    // Capítulo por timestamp absoluto; el mayor videoFinMs hace de duración efectiva si el llamador no la conoce
    const lastFin = Math.max(
      videoDurationMs,
      pasos[pasos.length - 1].videoFinMs ?? 0,
    )
    if (lastFin <= 0) return []
    return pasos.map((p) => ({
      pasoId: p.id,
      numero: p.numero,
      descripcion: p.descripcion,
      estado: p.estado,
      inicioMs: p.videoInicioMs!,
      finMs: p.videoFinMs!,
      anchoPct: Math.max(
        1,
        Math.round(((p.videoFinMs! - p.videoInicioMs!) / lastFin) * 100),
      ),
    }))
  }

  if (videoDurationMs <= 0) return []

  // Respaldo: distribución proporcional por duracionMs
  const totalDuracion = pasos.reduce(
    (acc, p) => acc + Math.max(0, p.duracionMs ?? 0),
    0,
  )
  if (totalDuracion <= 0) {
    // Sin duración en ningún paso, se divide en N segmentos iguales
    const equalWidth = Math.round(100 / pasos.length)
    let cursor = 0
    return pasos.map((p) => {
      const segmento: ChapterSegment = {
        pasoId: p.id,
        numero: p.numero,
        descripcion: p.descripcion,
        estado: p.estado,
        inicioMs: cursor,
        finMs: cursor + videoDurationMs / pasos.length,
        anchoPct: equalWidth,
      }
      cursor += videoDurationMs / pasos.length
      return segmento
    })
  }

  let cursorMs = 0
  return pasos.map((p) => {
    const duracion = Math.max(0, p.duracionMs ?? 0)
    const proporcion = duracion / totalDuracion
    const segmentoDuracion = videoDurationMs * proporcion
    const segmento: ChapterSegment = {
      pasoId: p.id,
      numero: p.numero,
      descripcion: p.descripcion,
      estado: p.estado,
      inicioMs: cursorMs,
      finMs: cursorMs + segmentoDuracion,
      anchoPct: Math.max(1, Math.round(proporcion * 100)),
    }
    cursorMs += segmentoDuracion
    return segmento
  })
}

/** Segmento activo para un tiempo en ms del video, o `null` si cae entre pasos. */
export function findChapterAtTime(
  segments: ChapterSegment[],
  timeMs: number,
): ChapterSegment | null {
  for (const seg of segments) {
    if (timeMs >= seg.inicioMs && timeMs < seg.finMs) return seg
  }
  return null
}