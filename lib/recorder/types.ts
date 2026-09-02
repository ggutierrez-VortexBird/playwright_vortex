/**
 * Tipos compartidos entre los módulos del recorder-worker.
 *
 * Mantener este archivo libre de imports pesados para que pueda usarse
 * tanto desde el worker Node (sin DOM) como desde el WS server (con `ws`).
 */

import type { BrowserContext, Page } from "playwright";
import type { WebSocket as WsServerSocket } from "ws";

/** Estado de una sesión de grabación en memoria del worker. */
export interface SessionEntry {
  sessionId: string;
  userId: string;
  urlInicial: string;
  context: BrowserContext;
  page: Page;
  /** CDP session para emitir Page.startScreencast */
  cdp: import("playwright").CDPSession;
  /** Sockets WS conectados a esta sesión (puede ser >1 si re-conexión) */
  clients: Set<WsServerSocket>;
  /** Última vez que el cliente mandó un heartbeat */
  lastHeartbeatAt: number;
  /** Timer para expiración por inactividad. undefined mientras no esté armado. */
  heartbeatTimer?: NodeJS.Timeout;
  createdAt: Date;
}

/** Mensajes que el cliente puede mandar al recorder por WS. */
export type WsClientMessage =
  | { type: "heartbeat" }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stop" }
  /** HU-G5: pedir el elemento bajo el cursor (cliente → worker → cliente). */
  | { type: "pick"; x: number; y: number }
  /** HU-G5: highlight on hover (enviado debounced 50ms). */
  | { type: "hover"; x: number; y: number }
  /** Input dispatch: mouse moved sobre el canvas del frontend → CDP Input.dispatchMouseEvent. */
  | { type: "mouse_move"; x: number; y: number }
  /** Input dispatch: mouse button pressed. */
  | { type: "mouse_down"; x: number; y: number; button?: "left" | "middle" | "right"; clickCount?: number }
  /** Input dispatch: mouse button released. */
  | { type: "mouse_up"; x: number; y: number; button?: "left" | "middle" | "right"; clickCount?: number }
  /** Input dispatch: scroll wheel. */
  | { type: "wheel"; x: number; y: number; deltaX: number; deltaY: number }
  /** Input dispatch: key pressed. */
  | { type: "key_down"; key: string; code?: string; modifiers?: number }
  /** Input dispatch: key released. */
  | { type: "key_up"; key: string; code?: string; modifiers?: number }
  /** Input dispatch: type text (insertText CDP — para escribir en inputs). */
  | { type: "type"; text: string };

/** Mensajes que el recorder manda al cliente por WS. */
export type WsServerMessage =
  | { type: "sesion_iniciando" }
  | { type: "sesion_lista"; ts: number }
  | { type: "sesion_pausada" }
  | { type: "sesion_reanudada" }
  | { type: "sesion_detenida" }
  | { type: "frame"; data: string; ts: number }
  | { type: "paso_agregado"; paso: PasoGrabadoDTO }
  | { type: "error"; msg: string }
  /** HU-G5: respuesta a {type:'pick'} con el elemento serializado. */
  | { type: "pick_result"; element: import("@/lib/grabador/dom-utils").SerializedElementFull | null }
  /** HU-G5: respuesta a {type:'hover'} con el bbox del elemento. */
  | { type: "highlight"; bbox: import("@/lib/grabador/dom-utils").SerializedElementFull["bbox"] | null };

export interface PasoGrabadoDTO {
  numero: number;
  tipo: string;
  descripcion: string;
  selectorPrincipal: unknown;
  valor?: string;
}

/** Resultado de validación de token. */
export type TokenValidation =
  | { ok: true; sessionId: string; userId: string }
  | { ok: false; reason: "invalid_signature" | "expired" | "malformed" };

/** Códigos de cierre del WS recorder. */
export const WS_CLOSE_INVALID_TOKEN = 4001;
export const WS_CLOSE_URL_FAILED = 4002;
export const WS_CLOSE_INTERNAL_ERROR = 4003;

/** Default TTL para tokens HMAC (10 min). */
export const DEFAULT_TOKEN_TTL_SEC = 600;