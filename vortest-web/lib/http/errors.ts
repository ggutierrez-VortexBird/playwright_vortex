/**
 * Convención única de errores para route handlers (ERR-01).
 *
 * `lib/*\/actions.ts` lanza tres "dialectos" de error:
 *   1. Sentinels de `lib/auth.ts` (FORBIDDEN_ERROR / NOT_FOUND_ERROR).
 *   2. Objetos `{ status, body }` (validaciones y conflictos de dominio).
 *   3. `AppError` (nuevo, con `status` y `code` propios).
 *
 * `mapErrorToResponse` es el único traductor a `NextResponse`. Los cuerpos
 * de error mantienen los mensajes que el frontend ya consume.
 */
import { NextResponse } from "next/server";
import { FORBIDDEN_ERROR, NOT_FOUND_ERROR } from "@/lib/auth";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

function messageOf(err: unknown): string | undefined {
  return (err as { message?: string } | null | undefined)?.message;
}

/**
 * Reconoce el sentinel tanto por identidad como por mensaje: al mockear
 * `@/lib/auth` en los tests, el sentinel del mock no es `===` al real.
 */
export function isForbiddenError(err: unknown): boolean {
  return err === FORBIDDEN_ERROR || messageOf(err) === "FORBIDDEN";
}

export function isNotFoundError(err: unknown): boolean {
  return err === NOT_FOUND_ERROR || messageOf(err) === "NOT_FOUND";
}

export function mapErrorToResponse(err: unknown): NextResponse {
  if (isForbiddenError(err)) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }
  if (isNotFoundError(err)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status },
    );
  }
  // Errores de dominio de las Server Actions: `{ status, body }`.
  if (
    err !== null &&
    typeof err === "object" &&
    typeof (err as { status?: unknown }).status === "number" &&
    "body" in err
  ) {
    const { status, body } = err as { status: number; body: unknown };
    return NextResponse.json(body, { status });
  }
  // request.json() con un cuerpo que no es JSON lanza SyntaxError: es un error del cliente, no del servidor.
  if (err instanceof SyntaxError) {
    return NextResponse.json({ error: "validation", message: "El cuerpo de la petición no es JSON válido" }, { status: 400 });
  }
  console.error("[api] Error no controlado:", err);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}
