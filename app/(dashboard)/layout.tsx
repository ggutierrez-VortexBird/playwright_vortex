import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { listEspacios, getEspacioById } from "@/lib/espacios/actions";
import { listProyectosActivos } from "@/lib/proyectos/actions";
import { ClientBand } from "@/components/ui/client-band";
import { EspacioSwitcher } from "@/components/ui/espacio-switcher";
import { ProyectoSwitcher } from "@/components/ui/proyecto-switcher";
import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";
import { UserMenu } from "@/components/ui/user-menu";
import { GlobalSearch } from "@/components/ui/global-search";
import { ProjectProvider } from "@/components/project-context";
import { ScopeBarWithContext } from "@/components/scope-bar-with-context";
import type { RolUsuario } from "@/lib/auth";

const ROL_LABEL: Record<string, string> = {
  superadmin: "Superadmin",
  admin: "Admin",
  tester: "Tester",
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id?: string }>;
}

const ALL_NAV_ITEMS: (SidebarNavItem & { roles: RolUsuario[] })[] = [
  { href: "/", label: "Inicio", icon: "home", roles: ["superadmin", "admin", "tester"] },
  { href: "/espacios", label: "Espacios", icon: "share", roles: ["superadmin", "admin"] },
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
            <Logo variant="dark" />
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
          <div className="flex items-center gap-2.5 border-t border-m3-on-primary-fixed-variant/30 px-4 py-3.5">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white font-label text-label-sm font-bold text-m3-primary-container">
              {usuario.email.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate font-body text-body-sm font-semibold text-white">
                {usuario.email.split("@")[0]}
              </div>
              <div className="truncate font-label text-label-sm text-m3-on-primary-container">
                {ROL_LABEL[usuario.rol] ?? usuario.rol}
              </div>
            </div>
          </div>
        </aside>

        {/* Main — TopAppBar + body */}
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-16 flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6">
            <ScopeBarWithContext />
            <EspacioSwitcher espacios={espacios} />
            <Suspense fallback={null}>
              <GlobalSearch />
            </Suspense>
            <span className="ml-auto" />
            <span
              aria-hidden="true"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-m3-secondary-container text-m3-secondary"
            >
              <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                notifications
              </span>
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-m3-error ring-2 ring-m3-secondary-container" />
            </span>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-m3-surface-container text-m3-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
            </span>
            <UserMenu email={usuario.email} rol={usuario.rol} />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProjectProvider>
  );
}
