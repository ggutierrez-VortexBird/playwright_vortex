/**
 * HU-G18 — Segmentación del video de una ejecución en capítulos por paso.
 *
 * El reporter emite `videoInicioMs`/`videoFinMs` por paso (relativos al
 * arranque del video ≈ arranque del run). Este módulo convierte esa lista
 * cruda en segmentos listos para renderizar:
 *
 *   - Si todos los pasos tienen timestamps válidos → los usamos tal cual,
 *     ordenando por `videoInicioMs`.
 *   - Si faltan timestamps (eventos legacy / tests) → caemos a una
 *     distribución proporcional usando `duracionMs` (modo legacy, igual
 *     al comportamiento previo a HU-G18).
 *   - Si no hay video (`videoDurationMs == 0`) → devolvemos [] y la UI
 *     muestra el placeholder.
 *
 * Mantenemos el módulo puro (sin imports de Prisma) para poder testarlo
 * sin DB.
 */

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
  /** Estado del paso (paso / fallo / reparado). */
  estado: string
  /** Offset en ms desde el inicio del video. */
  inicioMs: number
  /** Offset en ms desde el inicio del video. */
  finMs: number
  /** Ancho como porcentaje del video total (0-100, redondeado). */
  anchoPct: number
}

/**
 * Detecta si los pasos tienen timestamps válidos para usar capítulos
 * absolutos. Devuelve `true` si al menos un paso tiene `videoInicioMs`
 * no nulo y los timestamps son monótonamente crecientes.
 */
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

/**
 * Calcula los segmentos del chapter bar.
 *
 * @param pasos        Lista de pasos en orden de ejecución.
 * @param videoDurationMs Duración total del video en ms. Si los pasos
 *                        ya tienen `videoInicioMs`/`videoFinMs` válidos,
 *                        usamos el mayor `videoFinMs` como duración
 *                        efectiva (cubre el caso jsdom/tests donde el
 *                        <video> nunca no carga metadata). Si no hay
 *                        timestamps y `videoDurationMs <= 0`,
 *                        devolvemos [] (no hay bar).
 */
export function computeChapterSegments(
  pasos: PasoConCapitulo[],
  videoDurationMs: number,
): ChapterSegment[] {
  if (pasos.length === 0) return []

  if (pasosTienenCapitulosValidos(pasos)) {
    // Capítulo por timestamp absoluto. Usamos el mayor videoFinMs como
    // duración efectiva cuando el caller no la conoce (test mode).
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

  // Fallback legacy: distribución por duracionMs.
  const totalDuracion = pasos.reduce(
    (acc, p) => acc + Math.max(0, p.duracionMs ?? 0),
    0,
  )
  if (totalDuracion <= 0) {
    // Si no hay duración en ningún paso, dividimos en N segmentos iguales.
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

/**
 * Dado un tiempo en ms dentro del video, devuelve el segmento activo
 * (paso cuyo rango contiene ese tiempo) o `null` si estamos en un gap
 * entre pasos.
 */
export function findChapterAtTime(
  segments: ChapterSegment[],
  timeMs: number,
): ChapterSegment | null {
  for (const seg of segments) {
    if (timeMs >= seg.inicioMs && timeMs < seg.finMs) return seg
  }
  return null
}