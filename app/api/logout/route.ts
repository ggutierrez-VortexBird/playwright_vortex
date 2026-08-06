import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const response = new Response(null, {
    status: 307,
    headers: {
      location: "/login",
    },
  });
  const session = await getIronSession(request, response, sessionOptions);
  await session.destroy();
  return response;
}
