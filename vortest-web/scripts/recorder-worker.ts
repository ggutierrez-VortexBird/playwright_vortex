// Proceso del modo grabador: spawnea codegen-runner, vigila el `.spec.ts`, lo emite por WS y expone la API HTTP interna; env: RECORDER_WS_PORT, RECORDER_PUBLIC_URL, RECORDER_INTERNAL_SECRET, RECORDER_MAX_SESSIONS, RECORDER_HEARTBEAT_TIMEOUT_MS.

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
import { readFileSync } from "node:fs";
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
    // ignorar
  }
}

function closeWs(ws: WsServerSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    // ignorar
  }
}

/** Envía un mensaje a todos los clientes WS de una sesión. */
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
        // ignorar
      }
    }
  }
}

/** Registro de watchers: uno por sesión. */
const watchers = new Map<
  string,
  { close: () => void; isActive: () => boolean }
>();

/** Termina una grabación (Detener, cierre del navegador o falta de heartbeat); la lógica vive en `lib/recorder/stop-session.ts`. */
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
    // Si el usuario descartó, el `stop` que dispara el descarte no debe revertirla a 'detenida'.
    await prisma.sesionGrabacion.updateMany({ where: { id: sessionId, estado: { not: "descartada" } }, data });
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

  console.log(`[recorder-worker] Iniciando`);
  console.log(`[recorder-worker]   WS port: ${wsPort}`);
  console.log(`[recorder-worker]   Public URL: ${publicUrl}`);
  console.log(`[recorder-worker]   MAX_SESSIONS: ${process.env.RECORDER_MAX_SESSIONS ?? "3"}`);
  console.log(`[recorder-worker]   HEARTBEAT_TIMEOUT_MS: ${heartbeatTimeoutMs}`);

  // 1. Limpieza de huérfanos
  const cleaned = await cleanupOrphans();
  console.log(`[recorder-worker] Orphan cleanup: ${cleaned} sesiones`);

  // 2. API HTTP
  const httpServer = createHttpApi({
    port: wsPort,
    internalSecret,
    wsPublicUrl: publicUrl,
    tokenTtlSec,

    /** Arranca el subprocess de codegen, crea el watcher y registra la entry. */
    onBrowserReady: async (sessionId, specPath) => {
      console.log(`[recorder-worker] Subprocess vivo para ${sessionId} @ ${specPath}`);

      // Marca la sesión como 'activa' en DB
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

      // Watcher: cada escritura de Playwright emite spec_updated
      const watcher = watchCodegenSpec({
        specPath,
        debounceMs: 75, // algo más generoso para capturar ráfagas largas
        onUpdate: async (event) => {
          // Persiste specCode en DB (fuente de verdad)
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
          // URL actual: primer `page.goto("...")` del contenido; si no hay, la urlInicial de la sesión
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
          // El archivo desapareció y Playwright no lo recrea (el subprocess probablemente murió): se limpia la entry.
          console.warn(
            `[recorder-worker] spec file gone para ${sessionId} — removiendo entry`,
          );
          removeEntry(sessionId);
        },
      });
      watchers.set(sessionId, watcher);

      // El runner termina solo cuando el usuario cierra el navegador; eso debe cerrar la grabación igual que el botón Detener.
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

  // 3. Servidor WS
  const wss = new WebSocketServer({ server: httpServer });

  /** Heartbeat timeout: sesión sin heartbeats → mata el subprocess, persiste 'detenida' y quita la entry. */
  const onHeartbeatExpire: HeartbeatExpireCallback = async (sessionId) => {
    console.log(`[recorder-worker] heartbeat_timeout ${sessionId}`);
    // Misma parada que Detener y que el cierre del navegador, para persistir el script grabado
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
    // Mata todos los subprocesses del registry
    const reg = await import("../lib/recorder/session-registry");
    for (const [, entry] of reg.listEntries()) {
      try {
        if (entry.handle && entry.handle.isAlive()) {
          await entry.handle.kill();
        }
      } catch {
        // ignorar
      }
    }
    // Detiene todos los watchers
    for (const [, w] of watchers) w.close();
    watchers.clear();
    wss.clients.forEach((c) => c.close(1001, "shutting down"));
    wss.close();
    httpServer.close();
    try {
      await prisma.$disconnect();
    } catch (err) {
      console.error("[recorder-worker] Error al desconectar Prisma:", err);
    }
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

// WS: handshake y ping/pong

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

  // Verifica que la entry exista (no expirada)
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

  // Se lee el archivo al conectar: `initialSpec` es la foto del arranque y el goto inicial suele escribirse antes de que el cliente conecte.
  let specActual = entry.initialSpec;
  try {
    specActual = readFileSync(entry.handle.specPath, "utf8");
  } catch {
    /* sin archivo todavía: queda la foto inicial */
  }
  if (specActual) {
    sendMessage(ws, {
      type: "spec_updated",
      content: specActual,
      bytes: specActual.length,
      changedAt: new Date().toISOString(),
      currentUrl: extractCurrentUrl(specActual) ?? entry.urlInicial,
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
      // Codegen navega por sí solo; acá solo se loguea el intento del BrowserChrome
      console.log(
        `[recorder-worker] navigate request from ${sessionId}: ${msg.url}`,
      );
      return;
    }
    if (msg.type === "stop") {
      // Fire-and-forget: el handler WS no es async; se captura cualquier rechazo para no perderlo
      void handleStop(sessionId).catch((err) =>
        console.error(`[recorder-worker] error en handleStop(${sessionId}):`, err),
      );
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

/** Extrae la URL del primer `await page.goto("...")` del spec.ts; devuelve `null` si no hay. */
function extractCurrentUrl(specContent: string): string | null {
  if (!specContent) return null;
  const m = specContent.match(
    /\bpage\.goto\(\s*['"`]([^'"`]+)['"`]/,
  );
  return m ? (m[1] ?? null) : null;
}
