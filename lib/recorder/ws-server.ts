/**
 * WebSocket server para el recorder-worker.
 *
 *   - Handshake: parsear `?token=…` de la URL, validar con validateToken
 *   - Verificar que la sesión existe en DB y no está en estado terminal
 *     (token reusable durante toda la vida de la sesión, ver W3 fix)
 *   - Adjuntar cliente al SessionEntry
 *   - Manejar mensajes: heartbeat / pause / resume / stop / pick / hover
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
import { persistirPaso } from "@/lib/grabador/paso-repo";
import type { EventoDom } from "@/lib/grabador/translator";

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
      sendMessage(ws, { type: "pick_result", element: null, ariaSnapshot: null });
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
          aria: el.getAttribute("aria-label") || "",
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
        sendMessage(ws, { type: "pick_result", element: null, ariaSnapshot: null });
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
    // Tambien capturamos el aria snapshot (HU-G6 tipo 'snapshot') en el
    // mismo round-trip para que la UI tenga todo lo necesario para
    // ofrecer las acciones (verificar / parametro / snapshot) sin otro
    // request al worker.
    const full = buildFullFromPrimitives(result);
    const ariaSnapshot = await captureAriaSnapshot(entry, full);
    sendMessage(ws, { type: "pick_result", element: full, ariaSnapshot });
  } catch {
    // page.evaluate threw (target closed, page crashed, etc.)
    if (payload.type === "pick") {
      sendMessage(ws, { type: "pick_result", element: null, ariaSnapshot: null });
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

  // 3. Verificar que la sesión existe en DB y no está en estado terminal.
  //    Seguridad: el token HMAC (firma con SESSION_SECRET, TTL 30 min) ya
  //    garantiza que solo el frontend autorizado puede presentar el token;
  //    una segunda conexión concurrente o un refresh del navegador son
  //    casos válidos de reconexión, NO ataques — por eso NO usamos un flag
  //    one-shot (tokenUsado). El rechazo aplica solo a sesiones terminales
  //    (descartada/guardada) donde ya no hay BrowserContext vivo.
  let sesion: { id: string; estado: string } | null;
  try {
    sesion = await prisma.sesionGrabacion.findFirst({
      where: { token },
      select: { id: true, estado: true },
    });
  } catch (err) {
    console.error("[ws-server] DB error al validar token", err);
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, "error interno");
    return;
  }

  if (!sesion) {
    closeWs(ws, WS_CLOSE_INVALID_TOKEN, "token no existe");
    return;
  }
  if (sesion.estado === "descartada" || sesion.estado === "guardada") {
    closeWs(
      ws,
      WS_CLOSE_INVALID_TOKEN,
      `sesión en estado terminal '${sesion.estado}'`,
    );
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
      case "mouse_move":
      case "mouse_down":
      case "mouse_up":
      case "wheel":
      case "key_down":
      case "key_up":
      case "type":
        // Input dispatch: forward user interactions from the canvas
        // (frontend) to the browser via CDP Input.* events. This is the
        // codegen-equivalent: el usuario hace click en el canvas → worker
        // dispatchMouseEvent en la página real → DOM fires → __pw_report
        // captura → paso se persiste y aparece en el panel.
        void handleInputDispatch(sessionId, msg);
        break;
      case "navigate":
        // El usuario tipeo una URL en la URL bar del browser chrome y
        // presiono Enter. Navegamos la pagina real via page.goto.
        void handleNavigate(sessionId, msg.url);
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
 * Forward user input from the canvas (frontend) to the browser via CDP.
 *
 * Esto es lo que faltaba para que `playwright codegen`-equivalent funcione:
 * el usuario ve la pagina en el canvas (via screencast), hace click sobre
 * el canvas, el frontend captura las coordenadas y las manda por WS al
 * worker. El worker las traduce a CDP Input.* events y los inyecta en
 * la pagina. La pagina procesa el click nativamente → sus DOM listeners
 * disparan → __pw_report (init-script) envia el evento al worker → paso
 * se persiste en DB y aparece en el panel.
 *
 * Cada handler es fire-and-forget: si CDP falla (browser cerrado, etc.),
 * se loguea pero no se rompe el WS.
 */
async function handleInputDispatch(
  sessionId: string,
  msg: WsClientMessage,
): Promise<void> {
  const entry = getEntry(sessionId);
  if (!entry) return;
  if (!entry.cdp) {
    console.error(`[ws-server] input dispatch sin CDP session para ${sessionId}`);
    return;
  }

  try {
    // Usamos las APIs de alto nivel de Playwright (page.mouse / page.keyboard)
    // en lugar de CDP Input.dispatchMouseEvent directo. Internamente hacen
    // exactamente lo mismo pero manejan mejor el estado (mouse position,
    // modifier flags, focus tracking) — es lo que usa playwright codegen
    // por debajo, asi que cualquier cosa que funcione ahi funciona aca.
    switch (msg.type) {
      case "mouse_move":
        await entry.page.mouse.move(msg.x, msg.y);
        break;
      case "mouse_down": {
        // Antes de presionar, movemos el mouse a la posicion. Esto
        // garantiza que el browser tenga la posicion correcta registrada
        // (mouseMoved es prerequisito de mousePressed para algunos
        // elementos como sliders/drag).
        await entry.page.mouse.move(msg.x, msg.y);
        await entry.page.mouse.down({
          button: msg.button ?? "left",
          clickCount: msg.clickCount ?? 1,
        });
        console.log(
          `[recorder-worker] input mouse_down (${msg.x},${msg.y}) button=${msg.button ?? "left"}`,
        );
        break;
      }
      case "mouse_up":
        await entry.page.mouse.up({
          button: msg.button ?? "left",
          clickCount: msg.clickCount ?? 1,
        });
        console.log(
          `[recorder-worker] input mouse_up (${msg.x},${msg.y}) button=${msg.button ?? "left"}`,
        );
        break;
      case "wheel":
        await entry.page.mouse.wheel(msg.deltaX, msg.deltaY);
        break;
      case "key_down":
        await entry.page.keyboard.down(msg.key);
        break;
      case "key_up":
        await entry.page.keyboard.up(msg.key);
        break;
      case "type":
        // page.keyboard.type dispara keydown + keypress + input event por
        // cada char. Es lo que usa playwright codegen para llenar inputs.
        await entry.page.keyboard.type(msg.text);
        console.log(`[recorder-worker] input type "${msg.text}"`);
        break;
    }
  } catch (err) {
    console.error(`[ws-server] input dispatch failed for ${sessionId}:`, err);
  }
}

/**
 * Helper para que el http-api notifique al ws-server cuando un frame llega.
 * Itera todos los clientes del sessionId y les envía un mensaje JSON
 * `{type:'frame', data: '<base64jpeg>', ts: <ms>}` para que el frontend lo
 * decodifique sobre el <canvas>.
 *
 * IMPORTANTE: usa `client.send(JSON.stringify(...))` directamente — NO
 * `client.emit("__pw_frame__", ...)`. Los eventos custom de `ws` no
 * atraviesan el socket; el cliente solo recibe lo que se manda con `send`.
 */
export function broadcastFrame(
  sessionId: string,
  data: string,
  ts: number,
): void {
  const entry = getEntry(sessionId);
  if (!entry) return;
  const payload = JSON.stringify({ type: "frame", data, ts });
  for (const client of entry.clients) {
    if (client.readyState === 1 /* OPEN, per 'ws' constants */) {
      try {
        client.send(payload);
      } catch {
        // ignore: cliente probablemente cerró entre el check y el send
      }
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

/**
 * Persiste un paso "Abrir <URL>" en DB y lo broadcastea como
 * paso_agregado al cliente. Se usa cuando el usuario navega (URL bar,
 * click en link, history). Asi el panel derecho muestra la navegacion
 * como paso — como hace playwright codegen.
 *
 * Fire-and-forget: si la DB falla seguimos con la navegacion.
 */
export async function recordNavigationStep(
  sessionId: string,
  url: string,
  origen: "grabado" | "manual" = "grabado",
): Promise<void> {
  const evento: EventoDom = {
    type: "navigate",
    target: null,
    value: url,
    timestamp: Date.now(),
    deltaFromPreviousMs: 0,
    url,
  };
  try {
    const paso = await persistirPaso(evento, sessionId);
    if (paso) {
      // Reusar el helper broadcastPaso del recorder-worker para que el
      // paso llegue al PasoPanel del cliente con el formato correcto.
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
      const entry = getEntry(sessionId);
      if (entry) {
        for (const client of entry.clients) {
          if (client.readyState === 1) {
            try {
              client.send(payload);
            } catch {
              // ignore
            }
          }
        }
      }
      console.log(
        `[recorder-worker] paso navegar #${paso.numero} ${url} (origen=${origen})`,
      );
    }
  } catch (err) {
    console.error(`[recorder-worker] no se pudo persistir paso navegar`, err);
  }
}

/**
 * Navega la pagina del browser a una nueva URL (Enter en la URL bar).
 * El goto usa el mismo timeout que el goto inicial (10s) y respeta
 * domcontentloaded — suficiente para que la pagina pinte y el screencast
 * continue emitiendo frames.
 *
 * Despues del goto emitimos un {type:'url_changed'} a todos los clientes
 * para que la URL bar del chrome se sincronice.
 */
async function handleNavigate(sessionId: string, url: string): Promise<void> {
  const entry = getEntry(sessionId);
  if (!entry) return;
  try {
    // Normalizar URL — si no tiene scheme, anteponer https://
    let target = url.trim();
    if (!/^https?:\/\//i.test(target)) {
      target = `https://${target}`;
    }
    await entry.page.goto(target, {
      timeout: 10_000,
      waitUntil: "domcontentloaded",
    });
    const finalUrl = entry.page.url();
    // url_changed se emitira via Page.frameNavigated; lo mandamos igual
    // por si el listener no esta enganchado todavia.
    broadcastUrlChanged(sessionId, finalUrl);
    // Persistir como paso "Abrir <URL>".
    void recordNavigationStep(sessionId, finalUrl, "manual");
    console.log(`[recorder-worker] navigate OK ${sessionId} -> ${finalUrl}`);
  } catch (err) {
    console.error(
      `[recorder-worker] navigate failed for ${sessionId} to ${url}:`,
      err,
    );
    // Notificamos al cliente que la navegacion fallo
    const payload = JSON.stringify({
      type: "error",
      msg: `No se pudo navegar a ${url}`,
    });
    for (const client of entry.clients) {
      if (client.readyState === 1) {
        try {
          client.send(payload);
        } catch {
          // ignore
        }
      }
    }
  }
}

/**
 * Suscribe a Page.frameNavigated + Page.navigatedWithinDocument para que
 * cualquier cambio de URL (click en link, history back/forward, hash
 * change, pushState) se reporte al frontend como url_changed Y se
 * persista como paso "Abrir <URL>".
 *
 * Llamar UNA vez cuando el browser este listo (en onBrowserReady).
 * Idempotente: si ya hay listeners para esta sesion, los reemplaza.
 */
const navTrackingAttached = new Set<string>();
const navLastUrl = new Map<string, string>();

export function setupNavigationTracking(
  sessionId: string,
  cdp: import("playwright").CDPSession,
): void {
  if (navTrackingAttached.has(sessionId)) return;
  navTrackingAttached.add(sessionId);

  cdp.on("Page.frameNavigated", (params: { frame: { url: string; parentId?: string } }) => {
    // frameNavigated dispara para sub-frames tambien; solo nos importa el main frame
    // (main frame no tiene parentId). Si el parametro no incluye parentId,
    // lo aceptamos como main frame (compatibilidad entre versiones CDP).
    if (!params.frame || !params.frame.url) return;
    if (params.frame.parentId) return;
    const newUrl = params.frame.url;
    const prev = navLastUrl.get(sessionId);
    if (prev === newUrl) return; // sin cambio real
    navLastUrl.set(sessionId, newUrl);
    broadcastUrlChanged(sessionId, newUrl);
    void recordNavigationStep(sessionId, newUrl, "grabado");
  });

  cdp.on("Page.navigatedWithinDocument", (params: { url: string }) => {
    if (!params.url) return;
    const prev = navLastUrl.get(sessionId);
    if (prev === params.url) return;
    navLastUrl.set(sessionId, params.url);
    broadcastUrlChanged(sessionId, params.url);
    void recordNavigationStep(sessionId, params.url, "grabado");
  });

  console.log(`[recorder-worker] navigation tracking attached for ${sessionId}`);
}

function broadcastUrlChanged(sessionId: string, url: string): void {
  const entry = getEntry(sessionId);
  if (!entry) return;
  const payload = JSON.stringify({ type: "url_changed", url });
  for (const client of entry.clients) {
    if (client.readyState === 1) {
      try {
        client.send(payload);
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Resuelve el mejor selector disponible del elemento pickeado y captura
 * el aria snapshot del locator. Se usa en el flujo de "agregar snapshot"
 * (HU-G6 tipo 'snapshot') para que la UI pueda construir el paso
 * `expect(locator).toMatchAriaSnapshot(yaml)` sin un segundo round-trip.
 *
 * Si el locator no se puede resolver (elemento oculto, frame detached,
 * selector css fragil) devuelve null. La UI maneja null mostrando el
 * modal de snapshot como disabled.
 */
async function captureAriaSnapshot(
  entry: { page: import("playwright").Page },
  full: import("@/lib/grabador/dom-utils").SerializedElementFull | null,
): Promise<string | null> {
  if (!full || !full.candidates || full.candidates.length === 0) return null;
  // Probar candidatos en orden de prioridad hasta que uno resuelva
  // (locator() strict mode falla si hay >1 match — usamos first()).
  const priority = ["testid", "role", "id", "aria-label", "name", "text", "css"];
  for (const strat of priority) {
    const c = full.candidates.find((x) => x.strategy === strat);
    if (!c) continue;
    try {
      let locator;
      if (strat === "testid") {
        locator = entry.page.locator(`[data-testid="${c.value.replace(/^\[data-testid="|"\]$/g, "")}"]`).first();
      } else if (strat === "id") {
        locator = entry.page.locator(c.value).first();
      } else if (strat === "aria-label") {
        locator = entry.page.locator(c.value).first();
      } else if (strat === "name") {
        locator = entry.page.locator(c.value).first();
      } else if (strat === "text") {
        locator = entry.page.getByText(c.value).first();
      } else if (strat === "role") {
        // role value viene como "button" (sin "role=") — usar getByRole
        locator = entry.page.getByRole(c.value as Parameters<typeof entry.page.getByRole>[0]).first();
      } else {
        locator = entry.page.locator(c.value).first();
      }
      const snapshot = await locator.ariaSnapshot({ timeout: 1000 });
      if (snapshot && snapshot.trim().length > 0) return snapshot;
    } catch {
      // try next strategy
      continue;
    }
  }
  return null;
}

/**
 * Para tests y limpieza manual. Llamar cuando la sesion termina para
 * liberar el flag de tracking y permitir re-attach si se reanuda.
 */
export function clearNavigationTracking(sessionId: string): void {
  navTrackingAttached.delete(sessionId);
}