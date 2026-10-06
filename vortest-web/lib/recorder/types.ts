/**
 * Tipos compartidos V2 — Pivot playwright-codegen.
 *
 * En V2 la responsabilidad del recorder-worker se SIMPLIFICA
 * radicalmente: ya no mantiene BrowserContext vivo, ya no procesa
 * init-script, ya no traduce eventos. Solo:
 *   1. Spawnea `scripts/codegen-runner.ts` (grabador de Playwright sin
 *      ventana de Inspector).
 *   2. Vigila el archivo .spec.ts.
 *   3. Persiste el contenido + relay WS a clientes.
 *
 * Consecuencias en los tipos:
 *   - SessionEntry.context → SessionEntry.handle (subprocess)
 *   - SessionEntry.page, cdp → eliminados
 *   - WsServerMessage: droppaso_agregado, url_changed, pick_candidate.
 *     Drop también sesion_iniciando, sesion_lista.
 *     Quedan: spec_updated, sesion_detenida, error.
 *
 * Política ZERO modificación sobre el output del codegen (ACTA-Plan-Pivot):
 * el `specCode` que llega del browser es el single source of truth. El
 * servidor NO lo reformatea, NO le agrega comments, NO le agrega waits.
 */

import type { WebSocket as WsServerSocket } from "ws";
import type { SpawnCodegenResult } from "./codegen-subprocess";

/** Estado de una sesión de grabación en memoria del worker (V2). */
export interface SessionEntry {
  sessionId: string;
  userId: string;
  urlInicial: string;
  /** Handle del proceso de grabación (`scripts/codegen-runner.ts`). Único
   *  proceso vivo del lado grabador. */
  handle: SpawnCodegenResult;
  /** Snapshot del spec al momento del handshake (para que el cliente reciba el
   *  contenido actual sin re-fetchear /api/grabador/sesiones/[id]/spec). */
  initialSpec?: string;
  /** Sockets WS conectados a esta sesión. */
  clients: Set<WsServerSocket>;
  /** Última vez que el cliente mandó un heartbeat. */
  lastHeartbeatAt: number;
  /** Timer para expiración por inactividad. */
  heartbeatTimer?: NodeJS.Timeout;
  createdAt: Date;
}

/** Mensajes que el cliente puede mandar al recorder por WS (V2). */
export type WsClientMessage =
  | { type: "heartbeat" }
  | { type: "stop" }
  /** El QA tipeó una URL nueva en el BrowserChrome y apretó Ir. En V2
   *  el worker la inyecta como `await page.goto(...)` al inicio del
   *  .spec.ts la próxima vez que codegen reformatee (no es crítico —
   *  el QA puede tipear la URL directamente en la barra del browser
   *  headed de codegen; el BrowserChrome es solo un atajo). */
  | { type: "navigate"; url: string };

/** Mensajes que el recorder manda al cliente por WS (V2). */
export type WsServerMessage =
  /** El spec.ts cambió. `content` es el texto completo NUEVO (no un diff).
   *  Política ZERO modificación: lo que el QA ve es lo que viaja. */
  | {
      type: "spec_updated";
      content: string;
      bytes: number;
      changedAt: string;
      /** Última URL conocida del browser (sync desde `currentUrl` del
       *  entry). Opcional — puede llegar vacío mientras el browser
       *  no haya navegacionado todavía. */
      currentUrl?: string;
    }
  | { type: "sesion_detenida"; reason?: string }
  | { type: "error"; msg: string };

/** Resultado de validación de token. */
export type TokenValidation =
  | { ok: true; sessionId: string; userId: string }
  | { ok: false; reason: "invalid_signature" | "expired" | "malformed" };

/** Códigos de cierre del WS recorder. */
export const WS_CLOSE_INVALID_TOKEN = 4001;
export const WS_CLOSE_URL_FAILED = 4002;
export const WS_CLOSE_INTERNAL_ERROR = 4003;
export const WS_CLOSE_MAX_SESSIONS = 4004;

/** Default TTL para tokens HMAC (10 min). */
export const DEFAULT_TOKEN_TTL_SEC = 600;
