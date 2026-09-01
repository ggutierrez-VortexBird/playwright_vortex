/**
 * HTTP API interna del recorder-worker.
 *
 * Endpoints:
 *   POST /internal/start — inicia una sesión (auth: X-Internal-Secret)
 *     401 si secret inválido
 *     503 {error:'MAX_SESSIONS_REACHED'} si registry lleno
 *     200 {token, wsUrl} OK
 *
 *   GET /health — health sin auth
 *     200 {status:'ok'}
 *
 * El browser launch es ASÍNCRONO después de retornar 200; el caller
 * (Next.js action) confía en que el WS recibirá eventos cuando esté listo.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { issueToken } from "./auth";
import { addEntry, RegistryFullError } from "./session-registry";
import type { SessionEntry } from "./session-registry";
import type { LaunchSessionResult } from "./launch-session";
import { launchSession, UrlInaccesibleError } from "./launch-session";
import { startScreencast } from "./screencast";
import { WS_CLOSE_URL_FAILED } from "./types";
import type { WebSocket as WsServerSocket } from "ws";
import type { EventoDom } from "@/lib/grabador/translator";

export interface HttpApiOptions {
  port: number;
  internalSecret: string;
  wsPublicUrl: string;
  tokenTtlSec: number;
  /** Llamado cuando el browser se inicializa OK; el caller wirea el screencast al WS */
  onBrowserReady?: (sessionId: string, page: Page, cdp: CDPSession) => void;
  /** Llamado cuando el browser falla al inicializar (URL inaccesible) */
  onBrowserFailed?: (sessionId: string, err: UrlInaccesibleError) => void;
  /** Para inyectar mocks en tests (inyectar launchSession + screencast) */
  launchSessionImpl?: typeof launchSession;
  startScreencastImpl?: typeof startScreencast;
  /** HU-G3: handler invocado por cada DOM event reportado desde el browser. */
  onReport?: (sessionId: string, evento: EventoDom) => void | Promise<void>;
}

interface StartBody {
  sessionId: string;
  userId: string;
  urlInicial: string;
  storageState?: unknown;
  navegador?: string;
}

interface ApiContext {
  options: HttpApiOptions;
  server: import("node:http").Server;
}

import type { CDPSession, Page } from "playwright";

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString("utf8")));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function handleStart(ctx: ApiContext, req: IncomingMessage, res: ServerResponse): Promise<void> {
  const secret = req.headers["x-internal-secret"];
  if (typeof secret !== "string" || secret !== ctx.options.internalSecret) {
    sendJson(res, 401, { error: "unauthorized" });
    return;
  }

  let body: StartBody;
  try {
    body = (await readJson(req)) as StartBody;
  } catch {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  if (!body.sessionId || !body.userId || !body.urlInicial) {
    sendJson(res, 400, { error: "validation", message: "sessionId, userId, urlInicial required" });
    return;
  }

  // Generar token y crear entrada en registry ANTES de lanzar el browser
  const token = issueToken(body.sessionId, body.userId, ctx.options.tokenTtlSec);

  const launchImpl = ctx.options.launchSessionImpl ?? launchSession;
  const startScreencastImpl = ctx.options.startScreencastImpl ?? startScreencast;

  // Placeholder entry: la entry real se inserta cuando el browser termine de
  // inicializar (async). Si registry lleno, fallamos inmediatamente con 503.
  try {
    addEntry({
      sessionId: body.sessionId,
      userId: body.userId,
      urlInicial: body.urlInicial,
      // Estos se reemplazan cuando el browser esté listo
      context: null as unknown as import("playwright").BrowserContext,
      page: null as unknown as Page,
      cdp: null as unknown as CDPSession,
      clients: new Set<WsServerSocket>(),
      lastHeartbeatAt: Date.now(),
      heartbeatTimer: undefined,
      createdAt: new Date(),
    });
  } catch (err) {
    if (err instanceof RegistryFullError) {
      sendJson(res, 503, { error: "MAX_SESSIONS_REACHED", message: err.message });
      return;
    }
    throw err;
  }

  // Browser launch en background — la respuesta 200 ya salió con token
  void (async () => {
    try {
      const launched: LaunchSessionResult = await launchImpl({
        sessionId: body.sessionId,
        urlInicial: body.urlInicial,
        storageState: body.storageState,
        // HU-G3: wire the report handler so the browser-side init script
        // can deliver captured DOM events to the recorder-worker.
        onReport: ctx.options.onReport
          ? (evento) => ctx.options.onReport!(body.sessionId, evento)
          : undefined,
      });

      // Reemplazar entry con los reales
      const existing = (await import("./session-registry")).getEntry(body.sessionId);
      if (existing) {
        clearInterval(existing.heartbeatTimer);
      }
      const realEntry: SessionEntry = {
        sessionId: body.sessionId,
        ...launched,
        userId: body.userId,
        urlInicial: body.urlInicial,
        clients: new Set<WsServerSocket>(),
        lastHeartbeatAt: Date.now(),
        heartbeatTimer: undefined,
        createdAt: new Date(),
      };
      addEntry(realEntry);

      await startScreencastImpl(launched.page, () => {
        // frame handler lo cablea el ws-server en on('connection')
      });

      ctx.options.onBrowserReady?.(body.sessionId, launched.page, launched.cdp);
    } catch (err: unknown) {
      if (err instanceof UrlInaccesibleError) {
        ctx.options.onBrowserFailed?.(body.sessionId, err);
      }
      // Si falla el launch, removemos la entry placeholder
      const { removeEntry } = await import("./session-registry");
      removeEntry(body.sessionId);
    }
  })();

  sendJson(res, 200, {
    token,
    wsUrl: `${ctx.options.wsPublicUrl}/?token=${encodeURIComponent(token)}`,
  });
}

function handleHealth(res: ServerResponse): void {
  sendJson(res, 200, { status: "ok" });
}

/** Crea el HTTP server (no escucha todavía — llamar .listen()). */
export function createHttpApi(options: HttpApiOptions): import("node:http").Server {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://localhost`);
      if (req.method === "POST" && url.pathname === "/internal/start") {
        const ctx: ApiContext = { options, server };
        await handleStart(ctx, req, res);
        return;
      }
      if (req.method === "GET" && url.pathname === "/health") {
        handleHealth(res);
        return;
      }
      sendJson(res, 404, { error: "not_found" });
    } catch (err) {
      console.error("[http-api] unhandled error", err);
      sendJson(res, 500, { error: "internal" });
    }
  });

  return server;
}