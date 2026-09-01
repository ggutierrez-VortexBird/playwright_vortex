/**
 * In-memory session registry for the recorder-worker.
 *
 * Holds Map<sessionId, SessionEntry> with:
 *   - hard cap = RECORDER_MAX_SESSIONS (default 3)
 *   - per-session lock to avoid race conditions on add/remove
 *   - orphan cleanup at startup (marks stale active sessions as 'error')
 *
 * The Map is in-memory by design: if the worker crashes, sessions are
 * reaped by cleanupOrphans() on the next start (DB is source of truth).
 */

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
    // Cleanup lock entry if no later lock is queued
    if (locks.get(key) === prev.then(() => next)) {
      locks.delete(key);
    }
  }
}

/**
 * Inserts (or replaces) an entry in the registry.
 * Throws RegistryFullError if the cap is reached and the sessionId is new.
 */
export function addEntry(entry: SessionEntry): void {
  const max = getMaxSessions();
  // Replace-in-place case: same sessionId is allowed even when full.
  if (sessions.has(entry.sessionId)) {
    // Clean up timer of old entry
    const old = sessions.get(entry.sessionId)!;
    clearInterval(old.heartbeatTimer);
    sessions.set(entry.sessionId, entry);
    return;
  }
  if (sessions.size >= max) {
    throw new RegistryFullError(sessions.size, max);
  }
  sessions.set(entry.sessionId, entry);
}

/** Removes an entry and clears its heartbeat timer. Idempotent. */
export function removeEntry(sessionId: string): void {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  clearInterval(entry.heartbeatTimer);
  // Close any remaining WS clients (best-effort)
  for (const ws of entry.clients) {
    try {
      ws.close();
    } catch {
      // ignore
    }
  }
  sessions.delete(sessionId);
}

/** Returns the entry for a sessionId, or undefined. */
export function getEntry(sessionId: string): SessionEntry | undefined {
  return sessions.get(sessionId);
}

/** Adds a WS to the session's clients set. No-op if session doesn't exist. */
export function attachClient(sessionId: string, ws: WsServerSocket): void {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.clients.add(ws);
}

/** Removes a WS from the session's clients set. No-op if session doesn't exist. */
export function detachClient(sessionId: string, ws: WsServerSocket): void {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  entry.clients.delete(ws);
}

/** Current count of registered sessions. */
export function countEntries(): number {
  return sessions.size;
}

/**
 * Al arrancar, marca sesiones colgadas como error.
 * "Colgada" = estado IN ('iniciando','activa') con tokenUsado=true que no
 * recibió heartbeat en los últimos 5 minutos (HU-G22).
 *
 * Returns the number of sessions cleaned up.
 */
export async function cleanupOrphans(): Promise<number> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const result = await prisma.sesionGrabacion.updateMany({
    where: {
      estado: { in: ["iniciando", "activa"] },
      tokenUsado: true,
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

/** Test-only: reset internal state. Do not call from production code. */
export function _resetForTests(): void {
  for (const e of sessions.values()) {
    clearInterval(e.heartbeatTimer);
  }
  sessions.clear();
  locks.clear();
}

// Re-export so callers don't import `withLock` directly
export { withLock };