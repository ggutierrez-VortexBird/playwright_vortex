import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

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
