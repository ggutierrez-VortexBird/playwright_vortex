/** Cierre de una grabación (user_stop, browser_closed o heartbeat_timeout); primero se pide la parada ordenada al runner y luego se lee el .spec.ts; la función es reentrante. */

import type { SessionEntry, WsServerMessage } from "./types";

export type StopReason = "user_stop" | "browser_closed" | "heartbeat_timeout";

export interface StopSessionDeps {
  /** Entrada viva de la sesión, o undefined si ya se liberó. */
  getEntry: (sessionId: string) => SessionEntry | undefined;
  /** Libera la sesión del registro en memoria. */
  removeEntry: (sessionId: string) => void;
  /** Detiene el vigilante del archivo, si hay uno montado. */
  closeWatcher: (sessionId: string) => void;
  /** Lee el `.spec.ts` final. Devuelve null si no se pudo leer. */
  readSpec: (specPath: string) => Promise<string | null>;
  /** Persiste el cierre de la sesión. */
  persist: (
    sessionId: string,
    data: { estado: string; endedAt: Date; specCode?: string },
  ) => Promise<void>;
  /** Avisa a los clientes conectados. */
  broadcast: (sessionId: string, msg: WsServerMessage) => void;
}

export type StopSession = (
  sessionId: string,
  reason?: StopReason,
) => Promise<void>;

export function createStopSession(deps: StopSessionDeps): StopSession {
  const enCurso = new Set<string>();

  return async function stopSession(
    sessionId: string,
    reason: StopReason = "user_stop",
  ): Promise<void> {
    if (enCurso.has(sessionId)) return;
    const entry = deps.getEntry(sessionId);
    if (!entry) return;
    enCurso.add(sessionId);
    try {
      // 1. Parada ordenada del runner (vuelca el .spec.ts y sale).
      if (entry.handle?.isAlive()) {
        await entry.handle.kill().catch(() => undefined);
      }

      // 2. Leer el script final ya volcado.
      const specCode = await deps
        .readSpec(entry.handle.specPath)
        .catch(() => null);

      // 3. Persistir el cierre con el script incluido.
      await deps
        .persist(sessionId, {
          estado: "detenida",
          endedAt: new Date(),
          ...(specCode !== null && { specCode }),
        })
        .catch((err) => {
          console.error(
            `[stop-session] no pude persistir el cierre de ${sessionId}:`,
            err,
          );
        });

      // 4. Soltar recursos y avisar.
      deps.closeWatcher(sessionId);
      deps.broadcast(sessionId, { type: "sesion_detenida", reason });
      for (const client of Array.from(entry.clients)) {
        try {
          client.close(1000, "stop");
        } catch {
          // ignore
        }
      }
      deps.removeEntry(sessionId);
    } finally {
      enCurso.delete(sessionId);
    }
  };
}
