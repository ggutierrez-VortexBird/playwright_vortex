// lib/worker/artifacts.ts
// Motor Fase 1: sobrevive SOLO la mitad de escritura en DB. El escaneo del
// directorio de salida de Playwright + el cómputo de SHA256 ahora viven en
// vortest-engine/src/artifacts/artifacts.service.ts (el motor sube cada
// archivo por HTTP en vez de moverlo localmente con fs.renameSync).
//
// `ensureArtefacto` ya NO calcula el hash desde un archivo local — lo recibe
// ya calculado (por el motor) como parámetro, vía el multipart POST que
// atiende app/api/internal/artefactos/upload/route.ts. Dedup por
// sha256+ejecucionId, igual que el `ensureArtefacto` original de
// lib/worker/runner.ts.
//
// `linkCaptureToSubaccion`/`linkCaptureToSubaccionAuto` son un port
// verbatim de la heurística de matching por nombre de archivo que tenía
// `collectArtifacts` (ahora eliminado) — antes se disparaban durante un
// barrido de filesystem local; ahora las dispara
// scripts/execution-consumer.ts al recibir el evento `end`, a partir del
// array `artefactos: CollectedArtifactRef[]` que el motor ya subió y
// referenció (ver EndEventPayload en vortest-engine/src/queue/events.publisher.ts).
import { prisma } from '@/lib/db'
import { ArtefactoTipo, type Prisma } from '@prisma/client'

export interface EnsureArtefactoParams {
  ejecucionId: string
  tipo: ArtefactoTipo
  nombre: string
  /** Path local donde vortest-web ya escribió el archivo subido (storage/artefactos/<ejecucionId>/<fileName>). */
  path: string
  sha256: string
  bytes: number
  metadata?: Prisma.InputJsonValue
}

export interface EnsureArtefactoResult {
  artefactoId: string
  deduplicated: boolean
}

/**
 * Asegura que existe un Artefacto para el (ejecucionId, sha256) dado.
 * Si ya existe (subida repetida — el motor reintenta hasta 3 veces y puede
 * volver a subir el mismo archivo, o el mismo asset se referencia dos veces
 * por eventos distintos), retorna el id existente sin duplicar la fila.
 */
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

/**
 * Vincula una captura explícita (con fase detectada — toHaveScreenshot
 * naming) al primer PasoSubaccion del paso indicado. Port verbatim de la
 * función homónima que vivía en `collectArtifacts`.
 */
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

/**
 * Vincula una captura automática (screenshot automático de Playwright, sin
 * sufijo "actual"/"expected") al primer substep del paso que aún no tenga
 * una captura asignada. Port verbatim de la función homónima que vivía en
 * `collectArtifacts`.
 */
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

/** Forma mínima del `CollectedArtifactRef` del motor que este módulo necesita. */
export interface CollectedArtifactRefLite {
  artefactoId: string
  pasoNumero?: number | null
  phase?: 'captura-actual' | 'captura-referencia' | null
}

/**
 * Vincula una captura de nivel test (`captura-test` — screenshot:'on' de
 * Playwright, no atada a un substep específico por el reporter) al ÚLTIMO
 * substep sin captura del paso — es decir, la acción real que estaba
 * corriendo cuando Playwright la tomó. No sobrescribe capturas ya
 * existentes. Port verbatim de `handleCapturaTestEvent` (la mitad de DB) del
 * runner.ts original.
 */
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

  // [FIA-11] Si el motor envía `substepNumero`, la referencia es directa e
  // idempotente (una reentrega reescribe el MISMO subpaso). Si no viene
  // (motor viejo), se mantiene la heurística posicional: el último subpaso
  // sin captura — que NO es idempotente ante reentregas.
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

/**
 * Orquesta la vinculación de TODOS los artefactos recolectados por el motor
 * en el barrido post-ejecución (`EndEventPayload.artefactos`). Reemplaza el
 * bucle final de `collectArtifacts`: por cada referencia, resuelve el
 * PasoEjecucion por número y aplica la heurística fase-explícita vs.
 * automática.
 */
export async function linkCollectedArtifacts(
  ejecucionId: string,
  artefactos: CollectedArtifactRefLite[]
): Promise<void> {
  // [REN-04] Una sola query para todos los pasos referenciados (antes: un
  // findUnique por artefacto).
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
