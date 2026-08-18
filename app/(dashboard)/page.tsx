import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardHomePage() {
  const session = await getSession();
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.userId },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="topbar -mx-6 -mt-6 rounded-none">
        <h2>Bienvenido, {usuario?.email ?? "Usuario"}</h2>
        <span className="sub">
          {usuario?.rol === "superadmin"
            ? "Acceso completo · puedes crear y eliminar"
            : "Acceso de lectura y ejecución"}
        </span>
        <span className="spacer" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="eyebrow">Rol</div>
          <div className="mt-2 text-base font-medium capitalize text-ink">
            {usuario?.rol ?? "—"}
          </div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">Sesión activa</div>
          <div className="mt-2 text-base font-medium text-ink">
            <span className="pill p-pass">Sí</span>
          </div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">Email</div>
          <div className="mt-2 tmeta" style={{ textTransform: "none", letterSpacing: 0 }}>
            {usuario?.email ?? "—"}
          </div>
        </div>
        <div className="card p-4">
          <div className="eyebrow">Entorno</div>
          <div className="mt-2 tmeta" style={{ textTransform: "none", letterSpacing: 0 }}>
            QA · Playwright 1.62.1
          </div>
        </div>
      </div>
      <div className="note">
        <b>Siguiente paso:</b> selecciona un espacio en la barra superior, o
        entra directo a Proyectos para ver todas las tarjetas de cliente.
      </div>
    </div>
  );
}
