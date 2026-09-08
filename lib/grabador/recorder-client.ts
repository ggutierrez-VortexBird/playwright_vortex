/**
 * recorder-client.ts — cliente HTTP para hablarle al recorder-worker.
 *
 * V2 (Pivot playwright-codegen): el endpoint /internal/start ahora spawn
 * un subprocess en lugar de lanzar Chromium. El contrato desde el lado
 * Next.js es idéntico: { sessionId, userId, urlInicial, navegador } →
 * 200 { token, wsUrl, specPath } o 503 { error: 'MAX_SESSIONS_REACHED' }.
 *
 * IMPORTANTE: el worker habla HTTP en el mismo puerto que WS, así que la
 * base URL HTTP se deriva de `RECORDER_WS_PORT`. NO se usa
 * `RECORDER_PUBLIC_URL` (que es `ws://...`) porque `fetch` no entiende
 * el esquema `ws://` y se rechaza con "fetch failed".
 */

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
  /** Optional storageState — V2 lo ignora (codegen no soporta state).
   *  Mantenido en la firma por compatibilidad con tests viejos. */
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
  // Defensivo: nunca usar esquema `ws://` para fetch HTTP. Si por algún
  // cambio de env var esto se cuela, fallamos temprano con mensaje claro.
  if (baseUrl.startsWith("ws://") || baseUrl.startsWith("wss://")) {
    throw new RecorderUnavailableError(
      `RECORDER_INTERNAL_URL/RECORDER_PUBLIC_URL apunta a ${baseUrl}; se necesita http(s):// para el endpoint interno. Ajustá la env var.`,
    );
  }
  let res: Response;
  try {
    // Timeout cross-runtime: `AbortSignal.timeout` existe en Node 18+
    // pero NO está garantizado en jsdom (tests). Usamos un
    // AbortController + setTimeout manual que funciona en ambos.
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
        }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err: unknown) {
    // Logueamos el error COMPLETO (incluyendo cause) en el servidor para
    // diagnosticar problemas de red sin esconder el motivo tras un
    // mensaje genérico. La excepción que se devuelve al cliente sigue
    // siendo chica, pero en consola (Vortexbird logs) queda el detalle.
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
