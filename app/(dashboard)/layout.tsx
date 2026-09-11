import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { listEspacios, getEspacioById } from "@/lib/espacios/actions";
import { listProyectosActivos } from "@/lib/proyectos/actions";
import { ClientBand } from "@/components/ui/client-band";
import { EspacioSwitcher } from "@/components/ui/espacio-switcher";
import { ProyectoSwitcher } from "@/components/ui/proyecto-switcher";
import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";
import { UserMenu } from "@/components/ui/user-menu";
import { ProjectProvider } from "@/components/project-context";
import { ScopeBarWithContext } from "@/components/scope-bar-with-context";
import type { RolUsuario } from "@/lib/auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id?: string }>;
}

const ALL_NAV_ITEMS: (SidebarNavItem & { roles: RolUsuario[] })[] = [
  { href: "/espacios", label: "Espacios", icon: "workspaces", roles: ["superadmin", "admin"] },
  { href: "/proyectos", label: "Proyectos", icon: "folder_open", roles: ["superadmin", "admin", "tester"] },
  { href: "/casos", label: "Casos", icon: "fact_check", roles: ["superadmin", "admin", "tester"] },
  { href: "/ejecuciones", label: "Ejecuciones", icon: "play_circle", roles: ["superadmin", "admin", "tester"] },
  { href: "/credenciales", label: "Credenciales", icon: "vpn_key", roles: ["superadmin"] },
  { href: "/usuarios", label: "Usuarios", icon: "group", roles: ["superadmin", "admin"] },
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

  const usuario = await getUsuarioActual(session);

  if (!usuario) {
    redirect("/login");
  }

  const [espacios, espacio, proyectos] = await Promise.all([
    listEspacios(usuario),
    espacioId ? getEspacioById(espacioId) : null,
    listProyectosActivos(usuario),
  ]);

  const navItems: SidebarNavItem[] = ALL_NAV_ITEMS.filter((item) => item.roles.includes(usuario.rol));

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
            <SidebarNav items={navItems} />
          </nav>
          <div className="border-t border-m3-on-primary-fixed-variant/30 px-4 py-3">
            <ProyectoSwitcher proyectos={proyectos} />
          </div>
        </aside>

        {/* Main — TopAppBar + body */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6">
            <ScopeBarWithContext />
            <EspacioSwitcher espacios={espacios} />
            <span className="ml-auto" />
            <UserMenu email={usuario.email} rol={usuario.rol} />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProjectProvider>
  );
}
