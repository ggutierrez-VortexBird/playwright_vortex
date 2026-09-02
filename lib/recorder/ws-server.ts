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
import {
  serializeElement,
  type SerializedElementFull,
} from "@/lib/grabador/dom-utils";

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
 * HU-G5: handler compartido para `{type:'pick'}` y `{type:'hover'}`.
 *
 * Estrategia: ejecutamos `document.elementFromPoint(x, y)` en la página
 * del browser y serializamos el elemento via `dom-utils.serializeElement`.
 * El cliente recibe `pick_result` o `highlight` según el tipo.
 *
 * Si la página no está lista (entry existe pero `page` está null porque el
 * browser no terminó de bootear), respondemos con `null` para que el
 * cliente muestre el empty state sin crashear.
 *
 * Errores de Playwright (`Target closed`, etc.) se silencian — son
 * transitorios y la UI ya tiene un debounce/retry implícito.
 */
async function handleElementQuery(
  ws: WsServerSocket,
  sessionId: string,
  payload: { type: "pick" | "hover"; x: number; y: number },
): Promise<void> {
  const entry = getEntry(sessionId);
  if (!entry || !entry.page) {
    if (payload.type === "pick") {
      sendMessage(ws, { type: "pick_result", element: null });
    } else {
      sendMessage(ws, { type: "highlight", bbox: null });
    }
    return;
  }
  try {
    // We can't import `serializeElement` into the browser context, so we
    // grab the underlying DOM element + bbox separately. The full
    // serialization stays in Node.
    const result = (await entry.page.evaluate(
      ({ x, y }: { x: number; y: number }) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          tag: (el.tagName || "").toLowerCase(),
          role: el.getAttribute("role") || (el.tagName || "").toLowerCase(),
          aria:
            el.getAttribute("aria-label") ||
            el.getAttribute("name") ||
            el.getAttribute("id") ||
            "",
          name: el.getAttribute("name") || "",
          testId: el.getAttribute("data-testid") || "",
          text: ((el.textContent || "").trim()).slice(0, 50),
          id: el.id || "",
          // Pass a light representation; the Node side will compute
          // candidates/cssPath from these primitives.
          bbox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        };
      },
      { x: payload.x, y: payload.y },
    )) as
      | {
          tag: string;
          role: string;
          aria: string;
          name: string;
          testId: string;
          text: string;
          id: string;
          bbox: SerializedElementFull["bbox"];
        }
      | null;

    if (!result) {
      if (payload.type === "pick") {
        sendMessage(ws, { type: "pick_result", element: null });
      } else {
        sendMessage(ws, { type: "highlight", bbox: null });
      }
      return;
    }

    if (payload.type === "hover") {
      sendMessage(ws, { type: "highlight", bbox: result.bbox });
      return;
    }

    // pick: build the full serialized element from the primitives. We
    // can't pass the DOM node across the wire, so the Node helper
    // recomputes candidates from the primitive fields we extracted.
    const full = buildFullFromPrimitives(result);
    sendMessage(ws, { type: "pick_result", element: full });
  } catch {
    // page.evaluate threw (target closed, page crashed, etc.)
    if (payload.type === "pick") {
      sendMessage(ws, { type: "pick_result", element: null });
    } else {
      sendMessage(ws, { type: "highlight", bbox: null });
    }
  }
}

/**
 * HU-G5: reconstruye un SerializedElementFull a partir de las primitives
 * que devuelve `page.evaluate` (tag, role, aria, etc.). Mantiene la misma
 * forma que el init-script del browser para que el resto del pipeline
 * (paso-repo, UI, serializer) reciba la misma shape.
 */
function buildFullFromPrimitives(p: {
  tag: string;
  role: string;
  aria: string;
  name: string;
  testId: string;
  text: string;
  id: string;
  bbox: SerializedElementFull["bbox"];
}): SerializedElementFull {
  const candidates: Array<{ strategy: string; value: string }> = [];
  if (p.testId) {
    candidates.push({
      strategy: "testid",
      value: `[data-testid="${p.testId.replace(/"/g, '\\"')}"]`,
    });
  }
  if (p.id) candidates.push({ strategy: "id", value: `#${p.id}` });
  if (p.aria) {
    candidates.push({
      strategy: "aria-label",
      value: `[aria-label="${p.aria.replace(/"/g, '\\"')}"]`,
    });
  }
  if (p.name) {
    candidates.push({
      strategy: "name",
      value: `[name="${p.name.replace(/"/g, '\\"')}"]`,
    });
  }
  if (p.text && p.text.length < 30) {
    candidates.push({ strategy: "text", value: p.text });
  }
  candidates.push({ strategy: "css", value: "" }); // css path requires DOM walk, N/A from primitives

  return {
    tag: p.tag,
    role: p.role,
    aria: p.aria,
    name: p.name,
    testId: p.testId,
    text: p.text,
    candidates,
    bbox: p.bbox,
  };
}

/**
 * Backwards-compat re-export so unit tests can import the helper without
 * also importing the dom-utils path. (No-op at runtime; the function is
 * pure and lives in dom-utils.)
 */
export const _serializeElement = serializeElement;

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
        // W5 + HU-GR-2 — user-initiated stop persists estado='detenida'
        // + endedAt y cierra el WS, pero NO cierra el BrowserContext.
        // El entry queda en el registry con el contexto vivo, de modo
        // que un POST /reanudar posterior reconecta al mismo browser
        // (mismo URL, mismo cookies, mismo estado de página) en lugar
        // de relanzar Chromium desde la URL inicial.
        //
        // El contexto SOLO se cierra en:
        //   - heartbeat timeout (HU-G22 / C2) → onHeartbeatExpire
        //   - estado='descartada' → el próximo cleanupOrphans / DELETE en API
        //   - shutdown del worker (SIGTERM/SIGINT)
        //
        // Si la DB update falla seguimos cerrando el WS (fire-and-forget);
        // la sesión quedaría 'activa' hasta el próximo cleanupOrphans.
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
      case "pick":
      case "hover":
        // HU-G5: respond to element queries. Async — fire and forget.
        void handleElementQuery(ws, sessionId, msg);
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