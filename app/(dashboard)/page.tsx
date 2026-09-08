import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function DashboardHomePage() {
  const session = await getSession();
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.userId },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-4">
        <h2 className="font-headline text-headline-lg text-m3-primary">Bienvenido, {usuario?.email ?? "Usuario"}</h2>
        <span className="font-body text-body-sm text-m3-on-surface-variant">
          {usuario?.rol === "superadmin"
            ? "Acceso completo · puedes crear y eliminar"
            : "Acceso de lectura y ejecución"}
        </span>
        <span className="ml-auto" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-4">
          <div className="font-label text-[10.5px] uppercase tracking-wide text-m3-on-surface-variant">Rol</div>
          <div className="mt-2 text-base font-medium capitalize text-m3-on-surface">
            {usuario?.rol ?? "—"}
          </div>
        </div>
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-4">
          <div className="font-label text-[10.5px] uppercase tracking-wide text-m3-on-surface-variant">Sesión activa</div>
          <div className="mt-2 text-base font-medium text-m3-on-surface">
            <span className="inline-flex items-center rounded-full bg-m3-tertiary-container/15 px-2.5 py-0.5 font-label text-label-sm font-medium text-m3-on-tertiary-container border border-m3-tertiary-container/40">Sí</span>
          </div>
        </div>
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-4">
          <div className="font-label text-[10.5px] uppercase tracking-wide text-m3-on-surface-variant">Email</div>
          <div className="mt-2 font-body text-body-sm text-m3-on-surface" style={{ textTransform: "none", letterSpacing: 0 }}>
            {usuario?.email ?? "—"}
          </div>
        </div>
        <div className="rounded-xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm p-4">
          <div className="font-label text-[10.5px] uppercase tracking-wide text-m3-on-surface-variant">Entorno</div>
          <div className="mt-2 font-body text-body-sm text-m3-on-surface" style={{ textTransform: "none", letterSpacing: 0 }}>
            QA · Playwright 1.62.1
          </div>
        </div>
      </div>
      <div className="rounded-r border-l-2 border-m3-outline-variant bg-m3-surface-container-lowest px-4 py-3.5 font-body text-body-sm leading-relaxed text-m3-on-surface-variant">
        <b className="font-semibold text-m3-on-surface">Siguiente paso:</b> selecciona un espacio en la barra superior, o
        entra directo a Proyectos para ver todas las tarjetas de cliente.
      </div>
    </div>
  );
}
