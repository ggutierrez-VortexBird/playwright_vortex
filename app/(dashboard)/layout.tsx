import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listEspacios, getEspacioById } from "@/lib/espacios/actions";
import { listProyectosActivos } from "@/lib/proyectos/actions";
import { ClientBand } from "@/components/ui/client-band";
import { EspacioSwitcher } from "@/components/ui/espacio-switcher";
import { ProyectoSwitcher } from "@/components/ui/proyecto-switcher";
import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";
import { ProjectProvider } from "@/components/project-context";
import { ScopeBarWithContext } from "@/components/scope-bar-with-context";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id?: string }>;
}

const NAV_ITEMS: SidebarNavItem[] = [
  { href: "/espacios", label: "Espacios", icon: "workspaces" },
  { href: "/proyectos", label: "Proyectos", icon: "folder_open" },
  { href: "/casos", label: "Casos", icon: "fact_check" },
  { href: "/ejecuciones", label: "Ejecuciones", icon: "play_circle" },
  { href: "/credenciales", label: "Credenciales", icon: "vpn_key" },
];

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { id: espacioId } = await params;
  const session = await getSession();

  if (!session.userId) {
    redirect("/login");
  }

  const [usuario, espacios, espacio, proyectos] = await Promise.all([
    prisma.usuario.findUnique({
      where: { id: session.userId },
    }),
    listEspacios(),
    espacioId ? getEspacioById(espacioId) : null,
    listProyectosActivos(),
  ]);

  if (!usuario) {
    redirect("/login");
  }

  return (
    <ProjectProvider>
      <div className="flex min-h-screen bg-m3-background">
        {/* Rail — Material 3 dark sidebar (fase2/mockups/nuevo-caso-script.html) */}
        <aside className="sticky top-0 flex h-screen w-60 flex-none flex-col bg-m3-primary-container text-m3-on-primary">
          <ClientBand espacioColor={espacio?.color ?? null} />
          <div className="px-5 py-6">
            <Image
              src="/icons/logo.svg"
              alt="QAtheApp"
              width={200}
              height={58}
              priority
            />
            <p className="mt-1 font-label text-label-sm text-m3-on-primary-container">
              Automatización de pruebas
            </p>
          </div>
          <nav className="flex flex-1 flex-col gap-1 px-3">
            <SidebarNav items={NAV_ITEMS} />
          </nav>
          <div className="border-t border-m3-on-primary-fixed-variant/30 px-4 py-3">
            <ProyectoSwitcher proyectos={proyectos} />
          </div>
          <div className="border-t border-m3-on-primary-fixed-variant/30 px-5 py-4 font-label text-label-sm text-m3-on-primary-container">
            <div className="truncate">{usuario.email}</div>
            <div className="mt-0.5">{usuario.rol}</div>
            <div className="mt-2.5 text-m3-on-primary-container/70">
              Ambiente QA
              <br />
              Playwright 1.62.1
            </div>
            <form action="/api/logout" method="post" className="mt-3">
              <button
                type="submit"
                className="w-full rounded bg-m3-secondary-container px-3 py-2 text-center font-label text-label-sm font-semibold text-m3-on-secondary-container transition-colors hover:bg-m3-secondary-fixed"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </aside>

        {/* Main — TopAppBar + body */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6">
            <ScopeBarWithContext />
            <EspacioSwitcher espacios={espacios} />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProjectProvider>
  );
}
