import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/auth";

// GET: destino de las páginas que encuentran una sesión de un usuario borrado o desactivado; redirigir a /login a secas hacía un bucle con el middleware.
export async function GET(request: Request) {
  return POST(request);
}

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
