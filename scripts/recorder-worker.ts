/**
 * recorder-worker.ts — proceso Node standalone del modo grabador.
 *
 *   - HTTP API interna: POST /internal/start, GET /health
 *   - WebSocket server: ws://RECORDER_PUBLIC_URL
 *   - Orphan cleanup al arrancar
 *   - Heartbeat expiration (C2): si un cliente WS deja de mandar heartbeats
 *     por RECORDER_HEARTBEAT_TIMEOUT_MS, persiste estado='detenida' y
 *     cierra el BrowserContext.
 *   - DOM event capture (HU-G3): el browser llama __pw_report por cada
 *     evento; acá persistimos el PasoGrabado y broadcast `paso_agregado`.
 *   - Auto-wait detection (HU-G4): gaps >300ms se persisten como paso
 *     "Esperar X.Xs" para que el script generado respete delays.
 *
 * Reusa el patrón long-lived de scripts/worker.ts.
 *
 * Env vars (con defaults):
 *   RECORDER_WS_PORT=3100
 *   RECORDER_PUBLIC_URL=ws://localhost:3100
 *   RECORDER_INTERNAL_SECRET=required
 *   RECORDER_MAX_SESSIONS=3
 *   RECORDER_HEARTBEAT_TIMEOUT_MS=600000  (10 min)
 */
import { WebSocketServer, WebSocket as WsServerSocket } from "ws";
import { createHttpApi } from "../lib/recorder/http-api";
import {
  broadcastFrame,
  handleWsConnection,
  markBrowserReady,
} from "../lib/recorder/ws-server";
import { startScreencast } from "../lib/recorder/screencast";
import {
  cleanupOrphans,
  getEntry,
  removeEntry,
  type HeartbeatExpireCallback,
} from "../lib/recorder/session-registry";
import { launchSession, UrlInaccesibleError } from "../lib/recorder/launch-session";
import { prisma } from "../lib/db";
import { DEFAULT_TOKEN_TTL_SEC, WS_CLOSE_URL_FAILED } from "../lib/recorder/types";
import { persistirPaso, type PasoGrabadoRow } from "../lib/grabador/paso-repo";
import { detectarAutoWait } from "../lib/grabador/auto-wait";
import type { EventoDom } from "../lib/grabador/translator";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Env var requerida no definida: ${name}`);
  }
  return v;
}

async function main(): Promise<void> {
  const wsPort = Number.parseInt(process.env.RECORDER_WS_PORT ?? "3100", 10);
  const publicUrl = process.env.RECORDER_PUBLIC_URL ?? `ws://localhost:${wsPort}`;
  const internalSecret = requireEnv("RECORDER_INTERNAL_SECRET");
  const tokenTtlSec = DEFAULT_TOKEN_TTL_SEC;
  const heartbeatTimeoutMs = (() => {
    const v = process.env.RECORDER_HEARTBEAT_TIMEOUT_MS;
    const n = v ? Number.parseInt(v, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 600_000;
  })();

  console.log(`[recorder-worker] Iniciando`);
  console.log(`[recorder-worker]   WS port: ${wsPort}`);
  console.log(`[recorder-worker]   Public URL: ${publicUrl}`);
  console.log(`[recorder-worker]   MAX_SESSIONS: ${process.env.RECORDER_MAX_SESSIONS ?? "3 (default)"}`);
  console.log(`[recorder-worker]   HEARTBEAT_TIMEOUT_MS: ${heartbeatTimeoutMs}`);

  // 1. Orphan cleanup
  const cleaned = await cleanupOrphans();
  console.log(`[recorder-worker] Orphan cleanup: ${cleaned} sesiones marcadas como error`);

  // 2. HTTP API
  const screencastStarted = new Set<string>();

  /**
   * Per-session state for HU-G4 auto-wait detection. The `lastEventTs`
   * tracks the timestamp of the most recent reported DOM event so we
   * can decide if the gap to the next event should be persisted as a
   * "wait" step.
   */
  const lastEventTs = new Map<string, number>();

  /** Broadcast a `paso_agregado` message to all WS clients of the session. */
  function broadcastPaso(sessionId: string, paso: PasoGrabadoRow): void {
    const entry = getEntry(sessionId);
    if (!entry) return;
    const payload = JSON.stringify({
      type: "paso_agregado",
      paso: {
        id: paso.id,
        numero: paso.numero,
        tipo: paso.tipo,
        descripcion: paso.descripcion,
        valor: paso.valor,
        esValorSensible: paso.esValorSensible,
        parametroNombre: null,
        createdAt: paso.createdAt.toISOString(),
      },
    });
    for (const client of entry.clients) {
      if (client.readyState === WsServerSocket.OPEN) {
        try {
          client.send(payload);
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Handle a DOM event reported by the browser via __pw_report.
   *   1. Auto-wait detection (HU-G4): if the gap from the previous event
   *      is >300ms, persist a `wait` step first.
   *   2. Persist the actual event as a PasoGrabado.
   *   3. Broadcast `paso_agregado` over WS.
   *   4. Update lastEventTs.
   *
   * Persistence failures are logged but never break the recorder —
   * the UI falls back to live screencast even if paso persistence
   * is degraded.
   */
  async function handleReportedEvent(
    sessionId: string,
    evento: EventoDom,
  ): Promise<void> {
    try {
      // HU-G4: detect >300ms gaps and persist a "wait" paso first.
      const waitEvent = detectarAutoWait(
        lastEventTs.get(sessionId) ?? null,
        evento.timestamp,
      );
      if (waitEvent) {
        const waitPaso = await persistirPaso(waitEvent, sessionId);
        if (waitPaso) {
          broadcastPaso(sessionId, waitPaso);
        }
      }

      // Persist the actual event.
      const paso = await persistirPaso(evento, sessionId);
      if (paso) {
        broadcastPaso(sessionId, paso);
      }

      // Update timestamp tracker regardless of persistence outcome
      // (a failed persist still advances the cursor so we don't re-emit
      // the wait step on retry).
      lastEventTs.set(sessionId, evento.timestamp);
    } catch (err) {
      console.error(
        `[recorder-worker] handleReportedEvent failed for ${sessionId}`,
        err,
      );
    }
  }

  const httpServer = createHttpApi({
    port: wsPort,
    internalSecret,
    wsPublicUrl: publicUrl,
    tokenTtlSec,
    // HU-G3: bridge from browser DOM events → DB persistence + WS broadcast.
    onReport: handleReportedEvent,
    onBrowserReady: async (sessionId, page, _cdp) => {
      markBrowserReady(sessionId, screencastStarted);
      console.log(`[recorder-worker] Browser listo para sessionId=${sessionId}`);

      // Reset per-session auto-wait cursor for this session.
      lastEventTs.set(sessionId, Date.now());

      // Actualizar SesionGrabacion a estado='activa'
      await prisma.sesionGrabacion
        .update({
          where: { id: sessionId },
          data: { estado: "activa", startedAt: new Date() },
        })
        .catch((err) => console.error("[recorder-worker] DB update failed", err));

      // Iniciar screencast y broadcast frames a clientes WS
      await startScreencast(page, (data, ts) => {
        broadcastFrame(sessionId, data, ts);
      });
    },
    onBrowserFailed: async (sessionId, err) => {
      console.log(`[recorder-worker] Browser falló para sessionId=${sessionId}: ${err.message}`);
      lastEventTs.delete(sessionId);
      await prisma.sesionGrabacion
        .update({
          where: { id: sessionId },
          data: {
            estado: "error",
            mensajeError: err.message,
            endedAt: new Date(),
          },
        })
        .catch((e) => console.error("[recorder-worker] DB update failed", e));

      // Notificar a clientes WS conectados
      const { getEntry } = await import("../lib/recorder/session-registry");
      const entry = getEntry(sessionId);
      if (entry) {
        for (const client of entry.clients) {
          try {
            client.send(JSON.stringify({ type: "error", msg: err.message }));
            client.close(WS_CLOSE_URL_FAILED, "url inaccesible");
          } catch {
            // ignore
          }
        }
      }
    },
  });

  // 3. WebSocket server (mismo puerto que HTTP — ws upgrade)
  const wss = new WebSocketServer({ server: httpServer });

  // C2 — Heartbeat expiration handler. Cuando un cliente deja de mandar
  //      heartbeats por heartbeatTimeoutMs:
  //        - persiste estado='detenida' + endedAt en DB
  //        - cierra el BrowserContext
  //        - notifica a clientes WS restantes con {type:'sesion_detenida', reason:'heartbeat_timeout'}
  //        - remueve la entry del registry
  const onHeartbeatExpire: HeartbeatExpireCallback = async (sessionId: string) => {
    console.log(`[recorder-worker] Heartbeat timeout for sessionId=${sessionId}`);
    const entry = getEntry(sessionId);
    const payload = JSON.stringify({
      type: "sesion_detenida",
      reason: "heartbeat_timeout",
    });
    if (entry) {
      // Notify remaining WS clients (best-effort).
      for (const client of entry.clients) {
        try {
          if (client.readyState === client.OPEN) {
            client.send(payload);
            client.close(1000, "heartbeat_timeout");
          }
        } catch {
          // ignore
        }
      }
    }
    // Persist estado='detenida' (best-effort; failure logged but doesn't block).
    try {
      await prisma.sesionGrabacion.update({
        where: { id: sessionId },
        data: { estado: "detenida", endedAt: new Date() },
      });
    } catch (err) {
      console.error(`[recorder-worker] DB update failed on heartbeat expire`, err);
    }
    // Close the BrowserContext (if any).
    if (entry?.context) {
      try {
        await entry.context.close();
      } catch (err) {
        console.error(`[recorder-worker] context.close failed on heartbeat expire`, err);
      }
    }
    removeEntry(sessionId);
  };

  wss.on("connection", (ws: WsServerSocket, req) => {
    handleWsConnection(ws, req, screencastStarted, {
      heartbeatTimeoutMs,
      onHeartbeatExpire,
    }).catch((err) => {
      console.error("[recorder-worker] WS connection error", err);
    });
  });

  // 4. Listen
  httpServer.listen(wsPort, () => {
    console.log(`[recorder-worker] Listening on :${wsPort} (HTTP + WS)`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[recorder-worker] ${signal} recibido, cerrando...`);
    wss.clients.forEach((c: WsServerSocket) => c.close(1001, "shutting down"));
    wss.close();
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[recorder-worker] Error fatal", err);
  process.exit(1);
});