/**
 * WebSocket server para el recorder-worker.
 *
 *   - Handshake: parsear `?token=…` de la URL, validar con validateToken
 *   - Verificar tokenUsado=true (one-shot, segunda conexión con mismo token → close 4001)
 *   - Adjuntar cliente al SessionEntry
 *   - Manejar mensajes: heartbeat / pause / resume / stop
 *   - Broadcast frames desde CDP screencast a todos los clientes de la sesión
 *   - Heartbeat timer: cada `{type:'heartbeat'}` re-arma un timer; si el
 *     cliente deja de mandar heartbeats por `heartbeatTimeoutMs`, se invoca
 *     `onHeartbeatExpire(sessionId)` (C2)
 *
 * Diseño: este módulo NO instancia el `WebSocketServer` (eso es el entrypoint),
 * solo expone handlers. El entrypoint gluea `ws.Server.on('connection', handleConnection)`.
 */

import { WebSocket as WsServerSocket } from "ws";
import type { WebSocketServer } from "ws";
import { prisma } from "@/lib/db";
import { validateToken } from "./auth";
import {
  armHeartbeatTimer,
  attachClient,
  detachClient,
  getEntry,
} from "./session-registry";
import type { HeartbeatExpireCallback } from "./session-registry";
import { WS_CLOSE_INVALID_TOKEN } from "./types";
import type { WsClientMessage, WsServerMessage } from "./types";

function sendMessage(ws: WsServerSocket, msg: WsServerMessage): void {
  try {
    ws.send(JSON.stringify(msg));
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

/**
 * Handler de conexión nueva. Acepta el `ws.Server.on('connection', handler)`
 * con la forma `(ws, req) => void`.
 *
 * El handler es async porque hace CAS atómico en DB antes de aceptar.
 */
export async function handleWsConnection(
  ws: WsServerSocket,
  req: { url?: string },
  screencastStarted: Set<string>,
  options: {
    /** Timeout para considerar la sesión como expirada por inactividad (default 600_000). */
    heartbeatTimeoutMs?: number;
    /** Callback invocado cuando expira el heartbeat timer (C2). */
    onHeartbeatExpire?: HeartbeatExpireCallback;
    /** Opcional: handler de frames para screencast. */
    onFrame?: (sessionId: string, data: string, ts: number) => void;
  } = {},
): Promise<void> {
  // 1. Extraer token de la URL
  let token = "";
  try {
    const url = new URL(req.url ?? "/", "ws://localhost");
    token = url.searchParams.get("token") ?? "";
  } catch {
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, "URL inválida");
    return;
  }

  if (!token) {
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, "token requerido");
    return;
  }

  // 2. Validar firma + expiración (devuelve sessionId extraído del payload)
  const result = validateToken(token);
  if (!result.ok) {
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, `token ${result.reason}`);
    return;
  }
  const { sessionId } = result;

  // 3. Atomic CAS: una sola UPDATE que flippa tokenUsado=false → true.
  //    PostgreSQL garantiza que solo UNA transacción concurrente matchea
  //    el WHERE (los demás ven tokenUsado=true y obtienen count=0).
  //    Antes esto eran dos queries separadas (findFirst + update) y dos
  //    conexiones concurrentes pasaban el check → rompiendo one-shot (C1).
  let claimed: { count: number };
  try {
    claimed = await prisma.sesionGrabacion.updateMany({
      where: { token, tokenUsado: false },
      data: { tokenUsado: true },
    });
  } catch (err) {
    console.error("[ws-server] DB error al validar token", err);
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, "error interno");
    return;
  }

  if (claimed.count === 0) {
    // Token ausente en DB o ya fue usado por una conexión previa/concurrente.
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, "token ya utilizado o no existe");
    return;
  }

  // 5. Adjuntar al registry (puede ser que el browser aún no esté listo → igual
  //    aceptamos la conexión; los frames se enviarán cuando lleguen)
  attachClient(sessionId, ws);

  // 6. Mensaje inicial: sesion_iniciando si el browser aún no terminó el goto
  const entry = getEntry(sessionId);
  if (!entry || !screencastStarted.has(sessionId)) {
    sendMessage(ws, { type: "sesion_iniciando" });
  } else {
    sendMessage(ws, { type: "sesion_lista", ts: Date.now() });
  }

  // 6.5. Armar el heartbeat timer (C2). Si el caller no provee
  //      heartbeatTimeoutMs, default 10 min. Sin onHeartbeatExpire
  //      el timer igual se arma pero solo actualiza lastHeartbeatAt
  //      (modo "tracking-only", útil para tests / dry-run).
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 600_000;
  const onExpire: HeartbeatExpireCallback = options.onHeartbeatExpire ?? ((_id) => {});
  if (entry) {
    armHeartbeatTimer(sessionId, heartbeatTimeoutMs, onExpire);
  }

  // 7. Manejar mensajes del cliente
  ws.on("message", (data: import("ws").RawData) => {
    let msg: WsClientMessage;
    try {
      msg = JSON.parse(data.toString()) as WsClientMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "heartbeat":
        // Re-arm the timer on every heartbeat so an active client never expires.
        armHeartbeatTimer(sessionId, heartbeatTimeoutMs, onExpire);
        break;
      case "pause":
        sendMessage(ws, { type: "sesion_pausada" });
        break;
      case "resume":
        sendMessage(ws, { type: "sesion_reanudada" });
        break;
      case "stop":
        // W5 — user-initiated stop persists estado='detenida' + endedAt.
        // Fire-and-forget: failure to update DB does NOT prevent the WS
        // from closing gracefully. The session would otherwise stay
        // 'activa' until the next orphan cleanup at worker restart.
        prisma.sesionGrabacion
          .update({
            where: { id: sessionId },
            data: { estado: "detenida", endedAt: new Date() },
          })
          .catch((err) =>
            console.error("[ws-server] DB update failed on stop", err),
          );
        sendMessage(ws, { type: "sesion_detenida" });
        closeWs(ws, 1000, "stop");
        break;
    }
  });

  ws.on("close", () => {
    detachClient(sessionId, ws);
  });

  // 8. Si el caller quiere recibir frames para hacer broadcast, registramos
  //    un emisor que escribe al ws cuando hay un frame nuevo.
  if (options.onFrame) {
    ws.on("__pw_frame__", (data: string, ts: number) => {
      sendMessage(ws, { type: "frame", data, ts });
    });
  }
}

/**
 * Helper para que el http-api notifique al ws-server cuando un frame llega.
 * Itera todos los clientes del sessionId y emite el evento `__pw_frame__`
 * (custom event para evitar pisar la API de `ws`).
 */
export function broadcastFrame(
  sessionId: string,
  data: string,
  ts: number,
): void {
  const entry = getEntry(sessionId);
  if (!entry) return;
  for (const client of entry.clients) {
    if (client.readyState === WsServerSocket.OPEN) {
      client.emit("__pw_frame__", data, ts);
    }
  }
}

/**
 * Helper para marcar una sesión como "browser listo" (después del goto OK).
 * El próximo cliente que se conecte verá `sesion_lista` en lugar de `sesion_iniciando`.
 */
export function markBrowserReady(sessionId: string, screencastStarted: Set<string>): void {
  screencastStarted.add(sessionId);
}