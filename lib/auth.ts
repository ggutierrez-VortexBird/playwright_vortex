import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export interface SessionData {
  userId?: string;
  email?: string;
}

export const sessionOptions = {
  cookieName: "acta_session",
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 60 * 60 * 24,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function saveSession(userId: string, email: string) {
  const session = await getSession();
  session.userId = userId;
  session.email = email;
  await session.save();
}

export async function destroySession() {
  const session = await getSession();
  await session.destroy();
}

// Marker errors so route handlers can map them to HTTP responses
export const FORBIDDEN_ERROR = new Error("FORBIDDEN");
export const NOT_FOUND_ERROR = new Error("NOT_FOUND");

/**
 * Verify that the current session user has superadmin role.
 * Throws FORBIDDEN_ERROR if not authorized.
 */
export async function requireSuperadmin(session: SessionData): Promise<void> {
  if (!session.userId) {
    throw FORBIDDEN_ERROR;
  }

  const user = await prisma.usuario.findUnique({
    where: { id: session.userId },
    select: { rol: true },
  });

  if (user?.rol !== "superadmin") {
    throw FORBIDDEN_ERROR;
  }
}
