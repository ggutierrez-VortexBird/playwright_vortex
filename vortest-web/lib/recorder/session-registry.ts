// Registro en memoria de sesiones del recorder-worker (tope RECORDER_MAX_SESSIONS, lock por sesión); cleanupOrphans repara los huérfanos al arrancar.

import type { WebSocket as WsServerSocket } from "ws";
import { prisma } from "@/lib/db";
import type { SessionEntry } from "./types";

export type { SessionEntry };

const sessions = new Map<string, SessionEntry>();
const locks = new Map<string, Promise<void>>();

export class RegistryFullError extends Error {
  constructor(public readonly currentSize: number, public readonly maxSize: number) {
    super(`Registry lleno: ${currentSize}/${maxSize} sesiones`);
    this.name = "RegistryFullError";
  }
}

function getMaxSessions(): number {
  const v = process.env.RECORDER_MAX_SESSIONS;
  const parsed = v ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

async function withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  let release: () => void = () => {};
  const next = new Promise<void>((r) => (release = r));
  locks.set(
    key,
    prev.then(() => next),
  );
  try {
    await prev;
    return await fn();
  } finally {
    release();
    // Limpia el lock si no hay otro encolado
    if (locks.get(key) === prev.then(() => next)) {
      locks.delete(key);
    }
  }
}

/** Inserta (o reemplaza) una entry; lanza RegistryFullError si se alcanzó el tope y el sessionId es nuevo. */
export function addEntry(entry: SessionEntry): void {
  const max = getMaxSessions();
  // Reemplazo en el lugar: el mismo sessionId se permite aunque esté lleno
  if (sessions.has(entry.sessionId)) {
    // Limpia el timer de la entry anterior
    const old = sessions.get(entry.sessionId)!;
    clearTimeout(old.heartbeatTimer);
    sessions.set(entry.sessionId, entry);
    return;
  }
  if (sessions.size >= max) {
    throw new RegistryFullError(sessions.size, max);
  }
  sessions.set(entry.sessionId, entry);
}

/** Quita una entry y limpia su timer de heartbeat; idempotente. */
export function removeEntry(sessionId: string): void {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  clearTimeout(entry.heartbeatTimer);
  // Cierra los clientes WS restantes (best-effort)
  for (const ws of entry.clients) {
    try {
      ws.close();
    } catch {
      // ignorar
    }
  }
  sessions.delete(sessionId);
}

/** Devuelve la entry de un sessionId, o undefined. */
export function getEntry(sessionId: string): SessionEntry | undefined {
  return sessions.get(sessionId);
}

/** Iterador de todas las entries, usado en el apagado del worker. */
export function* listEntries(): IterableIterator<[string, SessionEntry]> {
  for (const [id, e] of sessions.entries()) yield [id, e];
}

/** Agrega un WS al set de clientes de la sesión; no hace nada si no existe. */
export function attachClient(sessionId: string, ws: WsServerSocket): void {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.clients.add(ws);
}

/** Quita un WS del set de clientes de la sesión; no hace nada si no existe. */
export function detachClient(sessionId: string, ws: WsServerSocket): void {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.clients.delete(ws);
}

/** Cantidad de sesiones registradas. */
export function countEntries(): number {
  return sessions.size;
}

/** Callback cuando expira el heartbeat de una sesión. */
export type HeartbeatExpireCallback = (sessionId: string) => void | Promise<void>;

/** Arma (o re-arma) el timer de heartbeat de la sesión; no hace nada si la sesión no existe. */
export function armHeartbeatTimer(
  sessionId: string,
  timeoutMs: number,
  onExpire: HeartbeatExpireCallback,
): NodeJS.Timeout | undefined {
  const entry = sessions.get(sessionId);
  if (!entry) return undefined;

  // Limpia el timer existente (re-armado)
  if (entry.heartbeatTimer) {
    clearTimeout(entry.heartbeatTimer);
  }
  entry.lastHeartbeatAt = Date.now();
  const timer = setTimeout(() => {
    // Se limpia la referencia para no hacer clearTimeout sobre un handle ya disparado
    const e = sessions.get(sessionId);
    if (e) e.heartbeatTimer = undefined;
    void onExpire(sessionId);
  }, timeoutMs);
  // No mantener vivo el proceso solo por este timer
  if (typeof timer.unref === "function") timer.unref();
  entry.heartbeatTimer = timer;
  return timer;
}

/** Cancela el timer de heartbeat de la sesión (idempotente); `removeEntry` ya lo llama. */
export function disarmHeartbeatTimer(sessionId: string): void {
  const entry = sessions.get(sessionId);
  if (!entry || !entry.heartbeatTimer) return;
  clearTimeout(entry.heartbeatTimer);
  entry.heartbeatTimer = undefined;
}

/** Al arrancar, marca como error las sesiones colgadas (iniciando/activa sin heartbeat en 5 min); devuelve cuántas limpió. */
export async function cleanupOrphans(): Promise<number> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const result = await prisma.sesionGrabacion.updateMany({
    where: {
      estado: { in: ["iniciando", "activa"] },
      updatedAt: { lt: fiveMinAgo },
    },
    data: {
      estado: "error",
      mensajeError: "worker reiniciado",
      endedAt: new Date(),
    },
  });
  return result.count;
}

/** Solo para tests: reinicia el estado interno. */
export function _resetForTests(): void {
  for (const e of sessions.values()) {
    clearTimeout(e.heartbeatTimer);
  }
  sessions.clear();
  locks.clear();
}

// Re-export para que los llamadores no importen `withLock` directamente
export { withLock };