/**
 * Cliente HTTP para llamar /internal/start del recorder-worker.
 *
 * Usado por la Server Action `iniciarSesionGrabacion` para hablar con el
 * worker que vive en otro proceso (Node standalone).
 *
 * Variables de entorno requeridas:
 *   RECORDER_INTERNAL_URL — base URL del recorder (ej. http://localhost:3100)
 *   RECORDER_INTERNAL_SECRET — compartido entre Next.js y recorder
 */

export interface InternalStartRequest {
  sessionId: string;
  userId: string;
  urlInicial: string;
  storageState?: unknown;
  navegador?: "chromium";
}

export interface InternalStartSuccess {
  token: string;
  wsUrl: string;
}

export interface InternalStartError {
  error: string;
  message?: string;
}

function getRecorderUrl(): string {
  return process.env.RECORDER_INTERNAL_URL ?? "http://localhost:3100";
}

function getInternalSecret(): string {
  const secret = process.env.RECORDER_INTERNAL_SECRET;
  if (!secret) {
    throw new Error(
      "RECORDER_INTERNAL_SECRET no definida; debe coincidir con la del recorder-worker",
    );
  }
  return secret;
}

export class RecorderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecorderUnavailableError";
  }
}

export class RecorderMaxSessionsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecorderMaxSessionsError";
  }
}

/**
 * POST /internal/start al recorder-worker.
 * Retorna `{token, wsUrl}` en 200.
 * Lanza `RecorderMaxSessionsError` si 503 con MAX_SESSIONS_REACHED.
 * Lanza `RecorderUnavailableError` si la red falla o 5xx.
 */
export async function callInternalStart(
  body: InternalStartRequest,
): Promise<InternalStartSuccess> {
  const url = `${getRecorderUrl()}/internal/start`;
  const secret = getInternalSecret();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new RecorderUnavailableError(`No se pudo conectar al recorder: ${msg}`);
  }

  if (res.status === 401) {
    throw new RecorderUnavailableError(
      "Recorder rechazó la autenticación (X-Internal-Secret incorrecto)",
    );
  }

  if (res.status === 503) {
    const errBody = (await res.json().catch(() => ({}))) as InternalStartError;
    throw new RecorderMaxSessionsError(
      errBody.message ?? "Recorder alcanzó MAX_SESSIONS",
    );
  }

  if (!res.ok) {
    throw new RecorderUnavailableError(`Recorder respondió ${res.status}`);
  }

  return (await res.json()) as InternalStartSuccess;
}