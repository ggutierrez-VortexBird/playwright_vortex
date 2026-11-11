// Tipos compartidos del recorder-worker: spawnea codegen-runner, vigila el .spec.ts y lo reenvía por WS; el `specCode` nunca se modifica.

import type { WebSocket as WsServerSocket } from "ws";
import type { SpawnCodegenResult } from "./codegen-subprocess";

/** Estado de una sesión de grabación en memoria del worker. */
export interface SessionEntry {
  sessionId: string;
  userId: string;
  urlInicial: string;
  /** Handle del proceso de grabación (`scripts/codegen-runner.ts`), único proceso vivo del lado grabador. */
  handle: SpawnCodegenResult;
  /** Snapshot del spec en el handshake, para que el cliente reciba el contenido actual sin pedirlo aparte. */
  initialSpec?: string;
  /** Sockets WS conectados a esta sesión. */
  clients: Set<WsServerSocket>;
  /** Última vez que el cliente mandó un heartbeat. */
  lastHeartbeatAt: number;
  /** Timer de expiración por inactividad. */
  heartbeatTimer?: NodeJS.Timeout;
  createdAt: Date;
}

/** Mensajes que el cliente puede mandar al recorder por WS. */
export type WsClientMessage =
  | { type: "heartbeat" }
  | { type: "stop" }
  /** El usuario escribió una URL nueva en el BrowserChrome; es solo un atajo, la URL también puede escribirse en la barra del navegador de codegen. */
  | { type: "navigate"; url: string };

/** Mensajes que el recorder manda al cliente por WS. */
export type WsServerMessage =
  /** El spec.ts cambió; `content` es el texto completo nuevo (no un diff). */
  | {
      type: "spec_updated";
      content: string;
      bytes: number;
      changedAt: string;
      /** Última URL conocida del navegador; puede venir vacía si aún no navegó. */
      currentUrl?: string;
    }
  | { type: "sesion_detenida"; reason?: string }
  | { type: "error"; msg: string };

/** Resultado de la validación de token. */
export type TokenValidation =
  | { ok: true; sessionId: string; userId: string }
  | { ok: false; reason: "invalid_signature" | "expired" | "malformed" };

/** Códigos de cierre del WS del recorder. */
export const WS_CLOSE_INVALID_TOKEN = 4001;
export const WS_CLOSE_URL_FAILED = 4002;
export const WS_CLOSE_INTERNAL_ERROR = 4003;
export const WS_CLOSE_MAX_SESSIONS = 4004;

/** TTL por defecto de los tokens HMAC (10 min). */
export const DEFAULT_TOKEN_TTL_SEC = 600;
