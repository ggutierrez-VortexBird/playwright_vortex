/** Envuelve route handlers con chequeo de sesión (401) y mapeo de errores; los guards de rol/proyecto siguen en el handler. */
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
