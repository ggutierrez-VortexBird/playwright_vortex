import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);
  const { pathname } = request.nextUrl;

  const isAuthenticated = Boolean(session.userId);
  const isLoginPage = pathname === "/login";

  // /api/internal/* lo llama el motor (sin cookie de sesión); cada handler se
  // protege con X-Internal-Secret. Debe salir ANTES del redirect a /login.
  if (pathname.startsWith("/api/internal/")) {
    return res;
  }

  // SEG-10: /api/* sin sesión → 401 JSON
  if (!isAuthenticated && pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!isAuthenticated && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|logo.png).*)"],
};
