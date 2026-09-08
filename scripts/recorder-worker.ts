/**
 * recorder-worker.ts — proceso Node standalone del modo grabador (PIVOT V2).
 *
 * ACTA-Plan-Pivot-Playwright-Codegen + grabador sin Inspector:
 *   - Ya NO se inyecta init-script para capturar eventos DOM.
 *   - Spawnea `scripts/codegen-runner.ts`, que activa el grabador de
 *     Playwright en modo programático (sin ventana de Inspector) y escribe
 *     el `.spec.ts`. Antes se spawneaba `npx playwright codegen`, que abre
 *     esa ventana siempre y obligaba a ocultarla desde el sistema operativo.
 *   - Queda observando el archivo `.spec.ts` que el runner escribe.
 *   - Cada cambio → broadcast WS `{type:'spec_updated', content, ...}` al cliente.
 *   - Lo que se escribe es EXACTAMENTE lo que produce codegen (sin agregar
 *     comments, ni waits, ni asserts manuales — política ZERO modificación).
 *   - Cuando el runner termina solo, porque el usuario cerró la ventana del
 *     navegador, la grabación se cierra igual que con el botón Detener.
 *
 * Servicios que levanta:
 *   - HTTP API interna:
 *       POST /internal/start  — auth X-Internal-Secret, body {sessionId,userId,urlInicial,navegador}
 *       POST /internal/stop   — mata el subprocess de la sesión
 *       GET  /health
 *   - WebSocketServer:
 *       handshake con token (auth vía validateToken)
 *       relay de `spec_updated` events desde el watcher
 *       heartbeat ping/pong (C2)
 *   - Orphan cleanup al arrancar: sesiones activas sin subprocess vivo se
 *     marcan como 'error' para no bloquear reintentos.
 *
 * Env vars (con defaults):
 *   RECORDER_WS_PORT=3100
 *   RECORDER_PUBLIC_URL=ws://localhost:3100
 *   RECORDER_INTERNAL_SECRET=required
 *   RECORDER_MAX_SESSIONS=3
 *   RECORDER_HEARTBEAT_TIMEOUT_MS=600000 (10 min)
 */

import { WebSocketServer, WebSocket as WsServerSocket } from "ws";
import { createHttpApi } from "../lib/recorder/http-api";
import { validateToken } from "../lib/recorder/auth";
import {
  cleanupOrphans,
  getEntry,
  removeEntry,
  attachClient,
  detachClient,
  armHeartbeatTimer,
  type HeartbeatExpireCallback,
} from "../lib/recorder/session-registry";
import { watchCodegenSpec } from "../lib/recorder/codegen-watcher";
import { createStopSession } from "../lib/recorder/stop-session";
import { prisma } from "../lib/db";
import {
  DEFAULT_TOKEN_TTL_SEC,
  WS_CLOSE_INVALID_TOKEN,
  WS_CLOSE_MAX_SESSIONS,
  type WsServerMessage,
} from "../lib/recorder/types";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Env var requerida no definida: ${name}`);
  }
  return v;
}

function sendMessage(ws: WsServerSocket, msg: WsServerMessage): void {
  try {
    if (ws.readyState === WsServerSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  } catch {
    // ignore
  }
}

function closeWs(ws: WsServerSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    // ignore
  }
}

/** Broadcast una message a TODOS los clientes WS de una sesión. */
function broadcastToClients(
  sessionId: string,
  msg: WsServerMessage,
): void {
  const entry = getEntry(sessionId);
  if (!entry) return;
  const payload = JSON.stringify(msg);
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

/** Watcher registry — 1 watcher por sesión. */
const watchers = new Map<
  string,
  { close: () => void; isActive: () => boolean }
>();

/**
 * Termina una grabación, sea por el botón Detener, por el cierre de la
 * ventana del navegador o por falta de señales de vida. La lógica vive en
 * `lib/recorder/stop-session.ts` para poder probarla sin levantar el worker.
 */
const handleStop = createStopSession({
  getEntry,
  removeEntry,
  closeWatcher: (sessionId) => {
    const w = watchers.get(sessionId);
    if (w) {
      w.close();
      watchers.delete(sessionId);
    }
  },
  readSpec: async (specPath) => {
    try {
      const fs = await import("node:fs/promises");
      return await fs.readFile(specPath, "utf8");
    } catch (err) {
      console.warn(`[recorder-worker] no pude leer ${specPath}:`, err);
      return null;
    }
  },
  persist: async (sessionId, data) => {
    await prisma.sesionGrabacion.update({ where: { id: sessionId }, data });
  },
  broadcast: broadcastToClients,
});

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

  console.log(`[recorder-worker] Iniciando (PIVOT V2)`);
  console.log(`[recorder-worker]   WS port: ${wsPort}`);
  console.log(`[recorder-worker]   Public URL: ${publicUrl}`);
  console.log(`[recorder-worker]   MAX_SESSIONS: ${process.env.RECORDER_MAX_SESSIONS ?? "3"}`);
  console.log(`[recorder-worker]   HEARTBEAT_TIMEOUT_MS: ${heartbeatTimeoutMs}`);

  // 1. Orphan cleanup
  const cleaned = await cleanupOrphans();
  console.log(`[recorder-worker] Orphan cleanup: ${cleaned} sesiones`);

  // 2. HTTP API
  const httpServer = createHttpApi({
    port: wsPort,
    internalSecret,
    wsPublicUrl: publicUrl,
    tokenTtlSec,

    /**
     * V2: antes onBrowserReady recibía el BrowserContext vivo y enganchaba
     * CDP. Ahora simplemente arranca el subprocess de playwright-codegen,
     * crea el watcher y arranca el entry en el registry (si addEntry
     * no había fallado por max sessions).
     */
    onBrowserReady: async (sessionId, specPath) => {
      console.log(`[recorder-worker] Subprocess vivo para ${sessionId} @ ${specPath}`);

      // Marcar la sesión como 'activa' en DB
      await prisma.sesionGrabacion
        .update({
          where: { id: sessionId },
          data: {
            estado: "activa",
            startedAt: new Date(),
            codegenFilePath: specPath,
          },
        })
        .catch((err) =>
          console.error("[recorder-worker] DB update failed", err),
        );

      // Watcher: cada write de Playwright broadcastea spec_updated.
      const watcher = watchCodegenSpec({
        specPath,
        debounceMs: 75, // <- un pelin más generoso que V1; captura rafagas largas
        onUpdate: async (event) => {
          // Persistir specCode en DB (single source of truth)
          await prisma.sesionGrabacion
            .update({
              where: { id: sessionId },
              data: { specCode: event.content },
            })
            .catch((err) =>
              console.error(
                `[recorder-worker] DB persist failed for ${sessionId}:`,
                err,
              ),
            );
          // Calcular URL actual del spec — primer `page.goto("...")` o
          // `await page.goto(...)` que aparece en el contenido. Si no
          // hay goto aún, mandamos el urlInicial de la sesión.
          const sessionEntry = getEntry(sessionId);
          const currentUrl =
            extractCurrentUrl(event.content) ?? sessionEntry?.urlInicial;
          // Broadcast WS
          broadcastToClients(sessionId, {
            type: "spec_updated",
            content: event.content,
            bytes: event.bytes,
            changedAt: event.changedAt,
            currentUrl,
          });
        },
        onGone: () => {
          // El archivo desapareció y Playwright no lo recrea. Probablemente
          // el subprocess murió. Limpiamos la entry para que la próxima vez
          // pueda crear otra.
          console.warn(
            `[recorder-worker] spec file gone para ${sessionId} — removiendo entry`,
          );
          removeEntry(sessionId);
        },
      });
      watchers.set(sessionId, watcher);

      // El runner termina solo cuando el usuario cierra la ventana del
      // navegador. Ese cierre tiene que terminar la grabación igual que el
      // botón Detener: persistir el script final, marcar la sesión y avisar
      // a la pantalla. Antes nadie escuchaba esto y la sesión quedaba
      // colgada en 'activa'.
      const entry = getEntry(sessionId);
      void entry?.handle
        .exitCode()
        .then((code) => {
          if (!getEntry(sessionId)) return; // la parada ya corrió
          console.log(
            `[recorder-worker] runner de ${sessionId} terminó (code=${code}) — cerrando grabación`,
          );
          return handleStop(sessionId, "browser_closed");
        })
        .catch((err) =>
          console.error(
            `[recorder-worker] error cerrando ${sessionId} tras la salida del runner:`,
            err,
          ),
        );
    },
    onBrowserFailed: async (sessionId, err) => {
      console.log(
        `[recorder-worker] start falló para sessionId=${sessionId}: ${err.message}`,
      );
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

      broadcastToClients(sessionId, { type: "error", msg: err.message });
    },
  });

  // 3. WS server
  const wss = new WebSocketServer({ server: httpServer });

  /**
   * Heartbeat timeout handler (C2). Sesión sin heartbeats → kill subprocess
   * + persist estado='detenida' + removeEntry.
   */
  const onHeartbeatExpire: HeartbeatExpireCallback = async (sessionId) => {
    console.log(`[recorder-worker] heartbeat_timeout ${sessionId}`);
    // Misma parada que Detener y que el cierre del navegador: así el
    // script grabado hasta ese momento también queda persistido.
    await handleStop(sessionId, "heartbeat_timeout");
  };

  wss.on("connection", (ws: WsServerSocket, req) => {
    void handleWsConnection(ws, req, {
      heartbeatTimeoutMs,
      onHeartbeatExpire,
    });
  });

  httpServer.listen(wsPort, () => {
    console.log(`[recorder-worker] Listening on :${wsPort} (HTTP + WS)`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[recorder-worker] ${signal} recibido, cerrando...`);
    // Kill all subprocesses registrados en el registry.
    const reg = await import("../lib/recorder/session-registry");
    for (const [, entry] of reg.listEntries()) {
      try {
        if (entry.handle && entry.handle.isAlive()) {
          await entry.handle.kill();
        }
      } catch {
        // ignore
      }
    }
    // Stop all watchers
    for (const [, w] of watchers) w.close();
    watchers.clear();
    wss.clients.forEach((c) => c.close(1001, "shutting down"));
    wss.close();
    httpServer.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

// =============================================================
// WS handshake + simple ping/pong
// =============================================================

interface HandleWsOptions {
  heartbeatTimeoutMs: number;
  onHeartbeatExpire: HeartbeatExpireCallback;
}

async function handleWsConnection(
  ws: WsServerSocket,
  req: { url?: string },
  opts: HandleWsOptions,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost`);
  const tokenParam = url.searchParams.get("token");
  if (!tokenParam) {
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, "no token");
    return;
  }
  const validation = validateToken(tokenParam);
  if (!validation.ok) {
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, validation.reason);
    return;
  }
  const sessionId = validation.sessionId;

  // Chequear que la entry exista (no expirada)
  const entry = getEntry(sessionId);
  if (!entry) {
    closeWs(ws, WS_CLOSE_MAX_SESSIONS, "sesion no encontrada");
    return;
  }
  attachClient(sessionId, ws);
  armHeartbeatTimer(
    sessionId,
    opts.heartbeatTimeoutMs,
    () => opts.onHeartbeatExpire(sessionId),
  );

  // Enviar spec actual como init (el cliente no tiene que re-buscarlo en /api)
  if (entry.initialSpec) {
    sendMessage(ws, {
      type: "spec_updated",
      content: entry.initialSpec,
      bytes: entry.initialSpec.length,
      changedAt: new Date().toISOString(),
      currentUrl: extractCurrentUrl(entry.initialSpec) ?? entry.urlInicial,
    });
  }

  ws.on("message", (raw) => {
    let msg: { type?: string; url?: string };
    try {
      msg = JSON.parse(raw.toString("utf8")) as { type?: string; url?: string };
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "heartbeat") {
      armHeartbeatTimer(
        sessionId,
        opts.heartbeatTimeoutMs,
        () => opts.onHeartbeatExpire(sessionId),
      );
      return;
    }
    if (msg.type === "navigate") {
      // V2: codegen navega por sí solo desde su inspector toolbar, no
      // exponemos goto programático aquí. Solo logueamos el intento
      // para que el QA sepa que su BrowserChrome llegó al worker.
      console.log(
        `[recorder-worker] navigate request from ${sessionId}: ${msg.url}`,
      );
      return;
    }
    if (msg.type === "stop") {
      void handleStop(sessionId);
    }
  });

  ws.on("close", () => {
    detachClient(sessionId, ws);
  });
}

main().catch((err) => {
  console.error("[recorder-worker] Error fatal", err);
  process.exit(1);
});

/**
 * Extrae la primera URL del spec.ts con la regex `await page.goto("...")`
 * (o variantes de comillas). Devuelve `null` si no hay goto.
 *
 * Usado para sincronizar la URL en el grabador sin exponer chrome real
 * al frontend. Si el QA navega con el popup de codegen, el codegen
 * escribe un `await page.goto(...)` al .spec.ts que detectamos acá.
 */
function extractCurrentUrl(specContent: string): string | null {
  if (!specContent) return null;
  const m = specContent.match(
    /\bpage\.goto\(\s*['"`]([^'"`]+)['"`]/,
  );
  return m ? (m[1] ?? null) : null;
}
