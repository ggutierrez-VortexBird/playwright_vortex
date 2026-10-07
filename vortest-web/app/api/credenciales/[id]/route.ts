/** DELETE /api/credenciales/[id] → 204; las grabaciones que la usaban quedan sin credencial (SetNull). */
import { withAuth } from "@/lib/http/with-auth";
import { eliminarCredencial } from "@/lib/credenciales/gestion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export const DELETE = withAuth<RouteParams>(async (_request, { params }, session) => {
  const { id } = await params;
  await eliminarCredencial(session, id);
  return new Response(null, { status: 204 });
});
