import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardHomePage() {
  const session = await getSession();
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.userId },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-ink">
        Bienvenido, {usuario?.email ?? "Usuario"}
      </h2>
      <p className="text-ink-2">
        Este es el panel principal de Acta. Selecciona una seccion del menu
        lateral para comenzar.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-rule bg-surface p-4">
          <p className="text-xs text-ink-3">Rol</p>
          <p className="mt-1 font-medium capitalize text-ink">{usuario?.rol ?? "-"}</p>
        </div>
        <div className="rounded border border-rule bg-surface p-4">
          <p className="text-xs text-ink-3">Sesion activa</p>
          <p className="mt-1 font-medium text-ink">Si</p>
        </div>
      </div>
    </div>
  );
}
