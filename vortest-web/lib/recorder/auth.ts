// Token HMAC-SHA256 `${sessionId}|${userId}|${exp}.${firma}` (SESSION_SECRET) para el WebSocket del recorder-worker; reutilizable hasta expirar o sesión terminal.

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

/** Emite un token HMAC para `(sessionId, userId)` con TTL `ttlSec`. */
export function issueToken(sessionId: string, userId: string, ttlSec: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${sessionId}|${userId}|${exp}`;
  const sig = createHmac("sha256", getSecret()).update(payload).digest();
  return `${payload}.${b64urlEncode(sig)}`;
}

/** Valida un token HMAC y devuelve una unión discriminada; `tokenUsado` se valida en session-registry.ts. */
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

  // Formato del payload: sessionId|userId|exp
  const payloadParts = payload.split("|");
  if (payloadParts.length !== 3) {
    return { ok: false, reason: "malformed" };
  }
  const [sessionId, userId, expStr] = payloadParts;
  const exp = Number.parseInt(expStr ?? "", 10);
  if (!Number.isFinite(exp)) {
    return { ok: false, reason: "malformed" };
  }

  // Verificación de expiración
  const now = Math.floor(Date.now() / 1000);
  if (exp < now) {
    return { ok: false, reason: "expired" };
  }

  // Firma (comparación en tiempo constante)
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