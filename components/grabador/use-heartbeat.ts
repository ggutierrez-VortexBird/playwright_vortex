"use client";

import { useEffect, useRef, useState } from "react";

/**
 * useHeartbeat — periodic POST /api/grabador/sesiones/[id]/heartbeat.
 *
 * HU-G2: el cliente Next.js manda heartbeats HTTP cada 15s para mantener
 * la fila SesionGrabacion "viva" en DB (refresh de updatedAt). El
 * heartbeat WS del recorder-worker es la fuente primaria de expiración;
 * este HTTP es un fallback que sobrevive caídas de WS.
 *
 * Comportamiento:
 *   - POST cada 15s al endpoint.
 *   - Pausa cuando `document.visibilityState === 'hidden'` (tab inactiva).
 *   - Reanuda cuando vuelve a 'visible'.
 *   - Hasta 3 reintentos en silencio por beat fallido (después, marca
 *     `online=false` y deja de reintentar hasta el próximo beat exitoso).
 *   - Cleanup completo en unmount.
 *
 * Retorna `{ online, lastBeat }`:
 *   - online: `true` mientras los beats van OK (o no se intentó aún).
 *   - lastBeat: epoch ms del último beat exitoso (o `null` al inicio).
 */

export interface UseHeartbeatOptions {
  /** Intervalo en ms (default 15_000). */
  intervalMs?: number;
  /** Reintentos máximos antes de marcar offline (default 3). */
  maxRetries?: number;
  /** Disable automático cuando el tab está oculto (default true). */
  pauseOnHidden?: boolean;
}

export interface UseHeartbeatResult {
  online: boolean;
  lastBeat: number | null;
}

export function useHeartbeat(
  sessionId: string,
  options: UseHeartbeatOptions = {},
): UseHeartbeatResult {
  const {
    intervalMs = 15_000,
    maxRetries = 3,
    pauseOnHidden = true,
  } = options;

  const [online, setOnline] = useState(true);
  const [lastBeat, setLastBeat] = useState<number | null>(null);

  // Refs para que el interval siempre lea el último valor (evita stale closures).
  const retriesRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const abortedRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    abortedRef.current = false;

    async function sendBeat(): Promise<void> {
      if (abortedRef.current) return;

      // Pause when tab is hidden.
      if (
        pauseOnHidden &&
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }

      try {
        const res = await fetch(
          `/api/grabador/sesiones/${encodeURIComponent(sessionId)}/heartbeat`,
          { method: "POST" },
        );
        if (!res.ok) {
          // 401/403/404/409 are not retried — those are auth/state errors
          // that won't resolve by retrying. The WS-level heartbeat in
          // the recorder-worker is still active.
          throw new Error(`heartbeat failed: ${res.status}`);
        }
        // OK: reset retries and mark online.
        retriesRef.current = 0;
        setOnline(true);
        setLastBeat(Date.now());
      } catch {
        retriesRef.current += 1;
        if (retriesRef.current >= maxRetries) {
          setOnline(false);
        }
        // Silent: surface only via `online=false`.
      }
    }

    function schedule(): void {
      if (abortedRef.current) return;
      // Clear any prior timer to avoid duplicate fires after resume.
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(async () => {
        await sendBeat();
        schedule();
      }, intervalMs);
    }

    function handleVisibility(): void {
      if (
        pauseOnHidden &&
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        // Pause: clear the timer.
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        return;
      }
      // Resume: re-arm the schedule (fire immediately so the session is
      // immediately marked alive when the tab returns).
      if (!abortedRef.current) {
        void sendBeat();
        schedule();
      }
    }

    // Initial beat + schedule.
    void sendBeat();
    schedule();

    if (
      pauseOnHidden &&
      typeof document !== "undefined" &&
      typeof document.addEventListener === "function"
    ) {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    return () => {
      abortedRef.current = true;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (
        typeof document !== "undefined" &&
        typeof document.removeEventListener === "function"
      ) {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
    };
  }, [sessionId, intervalMs, maxRetries, pauseOnHidden]);

  return { online, lastBeat };
}
