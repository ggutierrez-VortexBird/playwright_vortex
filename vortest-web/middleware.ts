import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, SessionData } from "./lib/auth";

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const session = await getIronSession<SessionData>(request, res, sessionOptions);
  const { pathname } = request.nextUrl;

  const isAuthenticated = Boolean(session.userId);
  const isLoginPage = pathname === "/login";

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
  // api/internal fuera del matcher: al pasar por acá Next corta el cuerpo en 10 MB y los videos grandes llegaban rotos (400).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|logo(?:-oscuro)?\\.png|api/internal).*)"],
};
