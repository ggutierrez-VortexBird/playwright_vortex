/** Cliente HTTP del recorder-worker; la base URL se deriva de `RECORDER_WS_PORT` (no de `RECORDER_PUBLIC_URL`, que es `ws://` y fetch lo rechaza). */

function defaultRecorderHttpUrl(): string {
  const port = process.env.RECORDER_WS_PORT ?? "3100";
  return process.env.RECORDER_INTERNAL_URL ?? `http://localhost:${port}`;
}

export class RecorderMaxSessionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecorderMaxSessionsError";
  }
}

export class RecorderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecorderUnavailableError";
  }
}

export interface CallInternalStartOptions {
  sessionId: string;
  userId: string;
  urlInicial: string;
  navegador?: string;
  /** storageState opcional, aplicado al contexto del codegen. */
  storageState?: unknown;
}

export interface CallInternalStartResult {
  token: string;
  wsUrl: string;
  specPath: string;
}

export async function callInternalStart(
  options: CallInternalStartOptions,
): Promise<CallInternalStartResult> {
  const internalSecret = process.env.RECORDER_INTERNAL_SECRET;
  if (!internalSecret) {
    throw new RecorderUnavailableError(
      "RECORDER_INTERNAL_SECRET no está definida en el server",
    );
  }
  const baseUrl = defaultRecorderHttpUrl();
  // Nunca usar `ws://` con fetch; si se cuela por la variable de entorno, falla temprano con mensaje claro.
  if (baseUrl.startsWith("ws://") || baseUrl.startsWith("wss://")) {
    throw new RecorderUnavailableError(
      `RECORDER_INTERNAL_URL/RECORDER_PUBLIC_URL apunta a ${baseUrl}; se necesita http(s):// para el endpoint interno. Ajustá la env var.`,
    );
  }
  let res: Response;
  try {
    // Timeout multi-runtime: AbortSignal.timeout no está garantizado en jsdom, así que se usa AbortController + setTimeout.
    const ac = new AbortController();
    const timeoutMs = 30_000;
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      res = await fetch(`${baseUrl}/internal/start`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": internalSecret,
        },
        body: JSON.stringify({
          sessionId: options.sessionId,
          userId: options.userId,
          urlInicial: options.urlInicial,
          navegador: options.navegador ?? "chromium",
          storageState: options.storageState ?? null,
        }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    // Se loguea el error completo (con cause) en el servidor; al cliente solo llega un mensaje genérico.
    if (err instanceof Error) {
      console.error(
        `[recorder-client] fetch to ${baseUrl}/internal/start failed:`,
        err.name,
        err.message,
        "cause:",
        (err as Error & { cause?: unknown }).cause ?? null,
      );
    }
    throw new RecorderUnavailableError(
      err instanceof Error ? err.message : "fetch failed",
    );
  }
  if (res.status === 503) {
    const body = (await res.json()) as { error?: string; message?: string };
    throw new RecorderMaxSessionsError(
      body.message ?? "Registry lleno",
    );
  }
  if (!res.ok) {
    throw new RecorderUnavailableError(
      `recorder /internal/start returned ${res.status}`,
    );
  }
  const body = (await res.json()) as {
    token: string;
    wsUrl: string;
    specPath: string;
  };
  return body;
}
