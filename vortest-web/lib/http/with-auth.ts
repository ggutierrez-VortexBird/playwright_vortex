/**
 * Wrapper de orden superior para route handlers (DUP-03).
 *
 * Centraliza el chequeo de sesión (401) y la traducción de errores
 * (`mapErrorToResponse`), de modo que ningún handler pueda "olvidarse" de
 * autenticar. NO reemplaza los guards de rol/proyecto: siguen siendo
 * responsabilidad del handler (`requireProyectoAccess`, etc.).
 *
 * Uso:
 *   export const GET = withAuth<RouteParams>(async (_req, { params }, session) => { ... })
 */
import { NextResponse } from "next/server";
import { getSession, getUsuarioActual, type SessionData } from "@/lib/auth";
import { mapErrorToResponse } from "@/lib/http/errors";

export type AuthedHandler<C> = (
  request: Request,
  context: C,
  session: SessionData,
) => Promise<Response>;

export function withAuth<C = unknown>(handler: AuthedHandler<C>) {
  return async (request: Request, context: C): Promise<Response> => {
    const session = await getSession();
    // La cookie sola no alcanza: el usuario puede haber sido borrado o desactivado después de emitirla.
    if (!session.userId || !(await getUsuarioActual(session))) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    try {
      return await handler(request, context, session);
    } catch (err) {
      return mapErrorToResponse(err);
    }
  };
}
