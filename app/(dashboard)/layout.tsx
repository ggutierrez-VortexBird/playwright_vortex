import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listEspacios, getEspacioById } from "@/lib/espacios/actions";
import { ClientBand } from "@/components/ui/client-band";
import { EspacioSwitcher } from "@/components/ui/espacio-switcher";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id?: string }>;
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  const { id: espacioId } = await params;
  const session = await getSession();

  if (!session.userId) {
    redirect("/login");
  }

  const [usuario, espacios, espacio] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.userId },
    }),
    listEspacios(),
    espacioId ? getEspacioById(espacioId) : null,
  ]);

  if (!usuario) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="sticky top-0 flex h-screen w-rail flex-col bg-ink text-surface">
        <ClientBand espacioColor={espacio?.color ?? null} />
        <div className="border-b border-ink-2 p-4">
          <h2 className="text-lg font-semibold">Acta</h2>
          <p className="mt-0.5 text-xs text-ink-3">v0.1.0</p>
        </div>
        <nav className="flex-1 p-3">
          <ul className="space-y-1 text-sm">
            <li>
              <a
                href="/proyectos"
                className="flex items-center gap-2 rounded px-3 py-2 hover:bg-ink-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-seal" />
                Proyectos
              </a>
            </li>
            <li>
              <a
                href="/espacios"
                className="flex items-center gap-2 rounded px-3 py-2 hover:bg-ink-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-client" />
                Espacios
              </a>
            </li>
            <li>
              <a
                href="/casos"
                className="flex items-center gap-2 rounded px-3 py-2 hover:bg-ink-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                Casos
              </a>
            </li>
            <li>
              <a
                href="/ejecuciones"
                className="flex items-center gap-2 rounded px-3 py-2 hover:bg-ink-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-param" />
                Ejecuciones
              </a>
            </li>
            <li>
              <a
                href="/credenciales"
                className="flex items-center gap-2 rounded px-3 py-2 hover:bg-ink-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-client" />
                Credenciales
              </a>
            </li>
          </ul>
        </nav>
        <div className="border-t border-ink-2 p-3 text-xs text-ink-3">
          <p className="truncate">{usuario.email}</p>
          <p className="mt-1 capitalize">{usuario.rol}</p>
          <form action="/api/logout" method="post" className="mt-3">
            <button
              type="submit"
              className="w-full rounded bg-stamp px-3 py-1.5 text-center text-surface hover:opacity-90"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-rule bg-surface px-6 py-3">
          <EspacioSwitcher espacios={espacios} />
          <h1 className="text-sm font-medium text-ink">Panel principal</h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
