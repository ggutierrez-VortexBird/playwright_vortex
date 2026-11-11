// Escritura en DB de los artefactos que sube el motor (hash ya calculado, dedup por sha256+ejecucionId) y su vinculación a pasos al recibir el evento `end`.
import { prisma } from '@/lib/db'
import { ArtefactoTipo, type Prisma } from '@prisma/client'

export interface EnsureArtefactoParams {
  ejecucionId: string
  tipo: ArtefactoTipo
  nombre: string
  /** Ruta local del archivo subido (storage/artefactos/<ejecucionId>/<fileName>). */
  path: string
  sha256: string
  bytes: number
  metadata?: Prisma.InputJsonValue
}

export interface EnsureArtefactoResult {
  artefactoId: string
  deduplicated: boolean
}

/** Asegura el Artefacto de (ejecucionId, sha256); si ya existe (reintentos del motor), devuelve su id. */
export async function ensureArtefacto(params: EnsureArtefactoParams): Promise<EnsureArtefactoResult> {
  const { ejecucionId, tipo, nombre, path, sha256, bytes, metadata } = params

  const existing = await prisma.artefacto.findFirst({
    where: { ejecucionId, sha256 },
    select: { id: true, path: true },
  })

  if (existing) {
    if (existing.path !== path) {
      await prisma.artefacto
        .update({ where: { id: existing.id }, data: { path } })
        .catch((err) => {
          console.error('[artifacts] Error actualizando path de artefacto duplicado:', err)
        })
    }
    return { artefactoId: existing.id, deduplicated: true }
  }

  const artefacto = await prisma.artefacto.create({
    data: { ejecucionId, tipo, nombre, path, sha256, bytes, metadata },
  })
  return { artefactoId: artefacto.id, deduplicated: false }
}

/** Vincula una captura explícita (con fase detectada) al primer PasoSubaccion del paso. */
export async function linkCaptureToSubaccion(
  ejecucionId: string,
  pasoEjecucionId: string,
  artefactoId: string,
  phase: 'captura-actual' | 'captura-referencia'
): Promise<void> {
  try {
    const subaccion = await prisma.pasoSubaccion.findFirst({
      where: { ejecucionId, pasoEjecucionId },
      orderBy: { numero: 'asc' },
      select: { id: true },
    })

    if (!subaccion) return

    const updateData =
      phase === 'captura-actual' ? { capturaActualId: artefactoId } : { capturaReferenciaId: artefactoId }

    await prisma.pasoSubaccion.update({
      where: { id: subaccion.id },
      data: updateData,
    })
  } catch (err) {
    console.error('[artifacts] Error linking capture to subaccion:', err)
  }
}

/** Vincula una captura automática al primer substep del paso que aún no tenga captura. */
export async function linkCaptureToSubaccionAuto(
  ejecucionId: string,
  pasoEjecucionId: string,
  artefactoId: string
): Promise<void> {
  try {
    const subaccion = await prisma.pasoSubaccion.findFirst({
      where: { ejecucionId, pasoEjecucionId },
      orderBy: { numero: 'asc' },
      select: { id: true, capturaActualId: true },
    })

    if (!subaccion) return
    if (subaccion.capturaActualId) return

    await prisma.pasoSubaccion.update({
      where: { id: subaccion.id },
      data: { capturaActualId: artefactoId },
    })
  } catch (err) {
    console.error('[artifacts] Error linking auto capture to subaccion:', err)
  }
}

/** Forma mínima del `CollectedArtifactRef` del motor que necesita este módulo. */
export interface CollectedArtifactRefLite {
  artefactoId: string
  pasoNumero?: number | null
  phase?: 'captura-actual' | 'captura-referencia' | null
}

/** Vincula una captura de nivel test (`captura-test`) al último substep sin captura del paso; no sobrescribe las existentes. */
export async function linkCapturaTestToLastSubaccion(
  ejecucionId: string,
  pasoNumero: number,
  capturaActualId: string | null,
  capturaReferenciaId: string | null,
  substepNumero?: number | null
): Promise<void> {
  if (!capturaActualId && !capturaReferenciaId) return

  const paso = await prisma.pasoEjecucion
    .findUnique({
      where: { ejecucionId_numero: { ejecucionId, numero: pasoNumero } },
      select: { id: true },
    })
    .catch(() => null)

  if (!paso) {
    console.warn(`[artifacts] captura-test: no se encontró paso numero ${pasoNumero} (ejecucion ${ejecucionId})`)
    return
  }

  // Con `substepNumero` la referencia es directa e idempotente; sin él (motor viejo) se usa el último subpaso sin captura, que no es idempotente.
  const subaccion =
    substepNumero !== null && substepNumero !== undefined
      ? await prisma.pasoSubaccion
          .findFirst({
            where: { ejecucionId, pasoEjecucionId: paso.id, numero: substepNumero },
            select: { id: true },
          })
          .catch(() => null)
      : await prisma.pasoSubaccion
          .findFirst({
            where: { ejecucionId, pasoEjecucionId: paso.id, capturaActualId: null },
            orderBy: { numero: 'desc' },
            select: { id: true },
          })
          .catch(() => null)

  if (!subaccion) {
    console.warn(
      substepNumero !== null && substepNumero !== undefined
        ? `[artifacts] captura-test: no se encontró el substep ${substepNumero} del paso ${paso.id}`
        : `[artifacts] captura-test: no se encontró substep sin captura para paso ${paso.id}`
    )
    return
  }

  const updateData: { capturaActualId?: string; capturaReferenciaId?: string } = {}
  if (capturaActualId) updateData.capturaActualId = capturaActualId
  if (capturaReferenciaId) updateData.capturaReferenciaId = capturaReferenciaId

  await prisma.pasoSubaccion.update({ where: { id: subaccion.id }, data: updateData }).catch((err) => {
    console.error('[artifacts] Error vinculando captura-test a substep:', err)
  })
}

/** Vincula todos los artefactos recolectados por el motor (`EndEventPayload.artefactos`) a sus pasos. */
export async function linkCollectedArtifacts(
  ejecucionId: string,
  artefactos: CollectedArtifactRefLite[]
): Promise<void> {
  // Una sola query para todos los pasos referenciados (en vez de un findUnique por artefacto)
  const numeros = [
    ...new Set(
      artefactos.map((r) => r.pasoNumero).filter((n): n is number => n !== null && n !== undefined)
    ),
  ]
  if (numeros.length === 0) return

  const pasos = await prisma.pasoEjecucion
    .findMany({
      where: { ejecucionId, numero: { in: numeros } },
      select: { id: true, numero: true },
    })
    .catch((err) => {
      console.error('[artifacts] Error buscando PasoEjecucion para linking:', err)
      return []
    })
  const pasoPorNumero = new Map(pasos.map((p) => [p.numero, p.id]))

  for (const ref of artefactos) {
    if (ref.pasoNumero === null || ref.pasoNumero === undefined) continue

    const pasoId = pasoPorNumero.get(ref.pasoNumero)
    if (!pasoId) continue

    if (ref.phase) {
      await linkCaptureToSubaccion(ejecucionId, pasoId, ref.artefactoId, ref.phase)
    } else {
      await linkCaptureToSubaccionAuto(ejecucionId, pasoId, ref.artefactoId)
    }
  }
}
