/** API HTTP interna del recorder-worker: POST /internal/start (X-Internal-Secret; 401, 503 MAX_SESSIONS_REACHED o 200 {token, wsUrl, specPath}) y GET /health. */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { issueToken } from "./auth";
import { addEntry, RegistryFullError } from "./session-registry";
import {
  spawnCodegen,
  type SpawnCodegenResult,
} from "./codegen-subprocess";
import { existsSync, readFileSync } from "node:fs";
import { secretoValido } from "@/lib/security/secret";

/** Cuánto se espera a que el runner avise que abrió el navegador; no es un timeout duro, la sesión sigue viva. */
const START_WAIT_MS = 10_000;

export interface HttpApiOptions {
  port: number;
  internalSecret: string;
  wsPublicUrl: string;
  tokenTtlSec: number;
  /** Directorio del .spec.ts (por defecto el tempdir del SO). */
  specDir?: string;
  /** Se llama cuando el subprocess arrancó bien; acá se monta el watcher. */
  onBrowserReady?: (sessionId: string, specPath: string) => void | Promise<void>;
  /** Se llama cuando algo falla antes del spawn (registry lleno, secret inválido). */
  onBrowserFailed?: (sessionId: string, err: { message: string }) => void;
}

interface StartBody {
  sessionId: string;
  userId: string;
  urlInicial: string;
  navegador?: string;
  storageState?: unknown;
}

interface ApiContext {
  options: HttpApiOptions;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Límite de tamaño del body (evita DoS por memoria). */
const MAX_JSON_BODY_BYTES = 10 * 1024 * 1024; // 10MB

async function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    let bytes = 0;
    let aborted = false;
    req.on("data", (chunk: Buffer) => {
      if (aborted) return;
      bytes += chunk.length;
      if (bytes > MAX_JSON_BODY_BYTES) {
        aborted = true;
        req.destroy();
        reject(new Error("payload_too_large"));
        return;
      }
      data += chunk.toString("utf8");
    });
    req.on("end", () => {
      if (aborted) return;
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function handleStart(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const secret = req.headers["x-internal-secret"];
  if (!secretoValido(typeof secret === "string" ? secret : null, ctx.options.internalSecret)) {
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
    sendJson(
      res,
      400,
      { error: "validation", message: "sessionId, userId, urlInicial required" },
    );
    return;
  }

  const navegador: "chromium" | "firefox" | "webkit" =
    typeof body.navegador === "string" &&
    ["chromium", "firefox", "webkit"].includes(body.navegador)
      ? (body.navegador as "chromium" | "firefox" | "webkit")
      : "chromium";

  // Genera el token antes de insertar la entry.
  const token = issueToken(body.sessionId, body.userId, ctx.options.tokenTtlSec);

  let handle: SpawnCodegenResult;
  try {
    handle = spawnCodegen(body.sessionId, {
      urlInicial: body.urlInicial,
      navegador,
      specDir: ctx.options.specDir,
      storageState: body.storageState,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: "spawn_failed", message: msg });
    return;
  }
  // La ruta la decide spawnCodegen; calcular otra acá hacía que el watcher vigilara un archivo que codegen nunca escribe y no llegaba ningún paso.
  const specPath = handle.specPath;

  // addEntry antes de responder 200; si el registry está lleno, mata el subprocess y falla rápido.
  try {
    addEntry({
      sessionId: body.sessionId,
      userId: body.userId,
      urlInicial: body.urlInicial,
      handle,
      initialSpec: existsSync(specPath)
        ? readFileSync(specPath, "utf8")
        : "",
      clients: new Set(),
      lastHeartbeatAt: Date.now(),
      heartbeatTimer: undefined,
      createdAt: new Date(),
    });
  } catch (err: unknown) {
    if (err instanceof RegistryFullError) {
      await handle.kill().catch(() => undefined);
      sendJson(res, 503, { error: "MAX_SESSIONS_REACHED", message: err.message });
      return;
    }
    throw err;
  }

  // Notifica al watcher antes de esperar el arranque para no perder las primeras escrituras.
  void ctx.options.onBrowserReady?.(body.sessionId, specPath);

  // Espera el aviso de que el navegador abrió; si tarda pero sigue vivo se responde igual, y solo se reporta error si el proceso murió antes.
  const arranco = await Promise.race([
    handle.ready(),
    new Promise<null>((r) => {
      const t = setTimeout(() => r(null), START_WAIT_MS);
      t.unref?.();
    }),
  ]);

  if (arranco === false && !handle.isAlive()) {
    sendJson(res, 500, {
      error: "runner_exited",
      message:
        "El proceso de grabación terminó antes de abrir el navegador. " +
        "Revisa el log del recorder-worker.",
    });
    return;
  }

  sendJson(res, 200, {
    token,
    wsUrl: `${ctx.options.wsPublicUrl}/?token=${encodeURIComponent(token)}`,
    specPath,
  });
}

function handleHealth(res: ServerResponse): void {
  sendJson(res, 200, { status: "ok" });
}

/** Crea el HTTP server (no escucha todavía; llamar .listen()). */
export function createHttpApi(
  options: HttpApiOptions,
): import("node:http").Server {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://localhost`);
      if (req.method === "POST" && url.pathname === "/internal/start") {
        const ctx: ApiContext = { options };
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
