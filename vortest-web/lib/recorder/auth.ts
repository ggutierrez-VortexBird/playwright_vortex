/**
 * HMAC token issuance/validation for the recorder-worker WebSocket.
 *
 * Token format: `${sessionId}|${userId}|${exp}.${base64url(HMAC)}`
 *   - exp is seconds-since-epoch
 *   - HMAC-SHA256 over the `${sessionId}|${userId}|${exp}` payload, signed
 *     with SESSION_SECRET
 *   - storage in DB as opaque `token` column; el token es REUTILIZABLE
 *     (refresh del navegador / reconexión son casos válidos). El rechazo
 *     aplica solo a: token mal formado, expirado, firma inválida, o sesión
 *     en estado terminal (descartada/guardada).
 *
 * Validity checks in order:
 *   1. Malformed (not exactly `payload.sig` with two parts)
 *   2. Expired (exp < now)
 *   3. Signature mismatch (HMAC over payload doesn't match)
 *
 * La verificación de estado de la sesión (descartada/guardada) NO vive acá —
 * se hace en ws-server.ts después de validar el token, leyendo el `estado`
 * de la fila correspondiente en DB.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { TokenValidation } from "./types";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET es requerido (>=32 chars) para firmar tokens del recorder",
    );
  }
  return secret;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

/**
 * Emite un token HMAC para `(sessionId, userId)` con TTL `ttlSec`.
 * Retorna el token listo para enviar al cliente.
 */
export function issueToken(sessionId: string, userId: string, ttlSec: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${sessionId}|${userId}|${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest();
  return `${payload}.${b64urlEncode(sig)}`;
}

/**
 * Valida un token HMAC. Retorna un discriminated union que el ws-server
 * puede mapear a close codes (4001 invalid, 4001 expired).
 *
 * El flag `tokenUsado` NO se valida acá — esa lógica vive en
 * session-registry.ts (atómico a nivel DB).
 */
export function validateToken(token: string): TokenValidation {
  if (typeof token !== "string" || token.length === 0) {
    return { ok: false, reason: "malformed" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { ok: false, reason: "malformed" };
  }
  const [payload, sig] = parts;
  if (!payload || !sig) {
    return { ok: false, reason: "malformed" };
  }

  // payload format: sessionId|userId|exp
  const payloadParts = payload.split("|");
  if (payloadParts.length !== 3) {
    return { ok: false, reason: "malformed" };
  }
  const [sessionId, userId, expStr] = payloadParts;
  const exp = Number.parseInt(expStr ?? "", 10);
  if (!Number.isFinite(exp)) {
    return { ok: false, reason: "malformed" };
  }

  // Expiration check
  const now = Math.floor(Date.now() / 1000);
  if (exp < now) {
    return { ok: false, reason: "expired" };
  }

  // Signature check (timing-safe)
  const expected = createHmac("sha256", getSecret()).update(payload).digest();
  let actual: Buffer;
  try {
    actual = b64urlDecode(sig);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "invalid_signature" };
  }

  return { ok: true, sessionId: sessionId ?? "", userId: userId ?? "" };
}