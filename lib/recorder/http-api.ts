/**
 * HTTP API interna del recorder-worker (V2 — Pivot playwright-codegen).
 *
 * Endpoints:
 *   POST /internal/start — auth: X-Internal-Secret
 *     401 si secret inválido
 *     503 {error:'MAX_SESSIONS_REACHED'} si registry lleno
 *     200 {token, wsUrl, specPath} OK
 *
 *   GET /health — health sin auth
 *     200 {status:'ok'}
 *
 * V2: NO hay BrowserContext. NO hay init-script. NO hay onReport callback.
 * Solo: spawnCodegen → addEntry(subprocess) → onBrowserReady(watcher).
 *
 * Diferencias vs V1 (http-api.ts viejo):
 *   - start ahora spawn un subprocess (no un BrowserContext).
 *   - onBrowserReady recibe (sessionId, specPath) — no (sessionId, page, cdp).
 *   - placeholders en registry NO se usan (entry real se inserta antes
 *     de spawnea el subprocess).
 *   - una URL inaccesible NO tumba la sesión: el runner deja el navegador
 *     abierto con la página de error para que el usuario escriba otra
 *     dirección. Solo se responde error si el proceso murió antes de
 *     abrir el navegador.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { issueToken } from "./auth";
import { addEntry, RegistryFullError } from "./session-registry";
import {
  spawnCodegen,
  resolveSpecPath,
  type SpawnCodegenResult,
} from "./codegen-subprocess";
import { existsSync, readFileSync } from "node:fs";

/**
 * Cuánto se espera a que el runner avise que el navegador abrió antes de
 * responder igual. No es un timeout duro: la sesión sigue viva.
 */
const START_WAIT_MS = 10_000;

export interface HttpApiOptions {
  port: number;
  internalSecret: string;
  wsPublicUrl: string;
  tokenTtlSec: number;
  /** Directorio donde vivir el .spec.ts. Default = OS tempdir. */
  specDir?: string;
  /** Llamado cuando el subprocess se inicializa OK. La watcher se monta acá. */
  onBrowserReady?: (sessionId: string, specPath: string) => void | Promise<void>;
  /** Llamado cuando algo falla pre-spawn (registry full, secret bad). */
  onBrowserFailed?: (sessionId: string, err: { message: string }) => void;
}

interface StartBody {
  sessionId: string;
  userId: string;
  urlInicial: string;
  navegador?: string;
}

interface ApiContext {
  options: HttpApiOptions;
}

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

async function handleStart(
  ctx: ApiContext,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
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

  // Generar token + spec path ANTES de insertar entry.
  const token = issueToken(body.sessionId, body.userId, ctx.options.tokenTtlSec);
  const specPath = resolveSpecPath(body.sessionId, ctx.options.specDir);

  let handle: SpawnCodegenResult;
  try {
    handle = spawnCodegen(body.sessionId, {
      urlInicial: body.urlInicial,
      navegador,
      specDir: ctx.options.specDir,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: "spawn_failed", message: msg });
    return;
  }

  // addEntry ANTES de responder 200. Si registry full, kill subprocess + fail fast.
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

  // Notify watcher chain (recorder-worker se engancha acá). Va antes de
  // esperar el arranque para que el watcher no se pierda las primeras
  // escrituras del runner.
  void ctx.options.onBrowserReady?.(body.sessionId, specPath);

  // Esperar a que el runner avise que el navegador abrió. Si tarda más de
  // la cuenta pero sigue vivo, se responde igual: el arranque en frío de un
  // navegador puede ser lento y la sesión ya está registrada. Solo se
  // reporta error si el proceso murió antes de abrir nada.
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
        "Revisá el log del recorder-worker.",
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

/** Crea el HTTP server (no escucha todavía — llamar .listen()). */
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
