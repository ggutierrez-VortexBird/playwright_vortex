/**
 * recorder-worker.ts — proceso Node standalone del modo grabador.
 *
 *   - HTTP API interna: POST /internal/start, GET /health
 *   - WebSocket server: ws://RECORDER_PUBLIC_URL
 *   - Orphan cleanup al arrancar
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
import { WebSocketServer, type WebSocket as WsServerSocket } from "ws";
import { createHttpApi } from "../lib/recorder/http-api";
import {
  broadcastFrame,
  handleWsConnection,
  markBrowserReady,
} from "../lib/recorder/ws-server";
import { startScreencast } from "../lib/recorder/screencast";
import { cleanupOrphans } from "../lib/recorder/session-registry";
import { launchSession, UrlInaccesibleError } from "../lib/recorder/launch-session";
import { prisma } from "../lib/db";
import { DEFAULT_TOKEN_TTL_SEC, WS_CLOSE_URL_FAILED } from "../lib/recorder/types";

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

  console.log(`[recorder-worker] Iniciando`);
  console.log(`[recorder-worker]   WS port: ${wsPort}`);
  console.log(`[recorder-worker]   Public URL: ${publicUrl}`);
  console.log(`[recorder-worker]   MAX_SESSIONS: ${process.env.RECORDER_MAX_SESSIONS ?? "3 (default)"}`);

  // 1. Orphan cleanup
  const cleaned = await cleanupOrphans();
  console.log(`[recorder-worker] Orphan cleanup: ${cleaned} sesiones marcadas como error`);

  // 2. HTTP API
  const screencastStarted = new Set<string>();

  const httpServer = createHttpApi({
    port: wsPort,
    internalSecret,
    wsPublicUrl: publicUrl,
    tokenTtlSec,
    onBrowserReady: async (sessionId, page, _cdp) => {
      markBrowserReady(sessionId, screencastStarted);
      console.log(`[recorder-worker] Browser listo para sessionId=${sessionId}`);

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

  wss.on("connection", (ws: WsServerSocket, req) => {
    handleWsConnection(ws, req, screencastStarted).catch((err) => {
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