import { redirect } from "next/navigation";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { Logo } from "@/components/ui/logo";
import { listEspacios } from "@/lib/espacios/actions";
import { listProyectosActivos } from "@/lib/proyectos/actions";
import { EspacioSwitcher } from "@/components/ui/espacio-switcher";
import { ProyectoSwitcher } from "@/components/ui/proyecto-switcher";
import { SidebarNav, type SidebarNavItem } from "@/components/ui/sidebar-nav";
import { UserMenu } from "@/components/ui/user-menu";
import { ProjectProvider } from "@/components/project-context";
import { BreadcrumbProvider } from "@/components/breadcrumb-context";
import { ScopeBarWithContext } from "@/components/scope-bar-with-context";
import { ROL_LABEL, type RolUsuario } from "@/lib/roles";
import { MobileNavProvider } from "@/components/mobile-nav-context";
import { MobileMenuButton } from "@/components/ui/mobile-menu-button";
import { ResponsiveSidebarShell } from "@/components/ui/responsive-sidebar-shell";
import { ToastProvider } from "@/components/ui/toast";

interface DashboardLayoutProps {
  children: React.ReactNode;
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

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const session = await getSession();

  if (!session.userId) {
    redirect("/login");
  }

  const usuario = await getUsuarioActual(session);

  if (!usuario) {
    redirect("/api/logout");
  }

  const [espacios, proyectos] = await Promise.all([
    listEspacios(usuario),
    listProyectosActivos(usuario),
  ]);

  const navItems: SidebarNavItem[] = ALL_NAV_ITEMS.filter((item) => item.roles.includes(usuario.rol));

  return (
    <ToastProvider>
    <ProjectProvider>
      <BreadcrumbProvider>
        <MobileNavProvider>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:rounded-md focus:bg-m3-primary focus:px-4 focus:py-2 focus:font-label focus:text-label-lg focus:text-m3-on-primary"
        >
          Saltar al contenido
        </a>
        <div className="flex min-h-screen bg-m3-background">
          {/* Rail — Material 3 dark sidebar (fase2/mockups/nuevo-caso-script.html).
              lg: completo (sin cambios) · md: riel de solo iconos · <md: cajón. */}
          <ResponsiveSidebarShell>
            <div className="flex items-center justify-center px-5 py-6 md:px-2 lg:justify-start lg:px-5">
              <div className="md:hidden lg:block">
                <Logo variant="dark" />
                <p className="mt-1 font-label text-label-sm text-m3-on-primary-container">
                  Automatización de pruebas
                </p>
              </div>
              <span
                aria-hidden="true"
                className="hidden h-10 w-10 items-center justify-center rounded-lg bg-white/10 font-headline text-headline-md font-bold text-white md:flex lg:hidden"
              >
                V
              </span>
            </div>
            <nav className="flex flex-1 flex-col gap-1 px-3">
              <SidebarNav items={navItems} />
            </nav>
            {usuario.rol !== "superadmin" && (
              <div className="border-t border-m3-on-primary-fixed-variant/30 px-4 py-3 md:hidden lg:block">
                <ProyectoSwitcher proyectos={proyectos} />
              </div>
            )}
            <div className="flex items-center gap-2.5 border-t border-m3-on-primary-fixed-variant/30 px-4 py-3.5 md:justify-center lg:justify-start">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-white font-label text-label-sm font-bold text-m3-primary-container">
                {usuario.email.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 md:hidden lg:block">
                <div className="truncate font-body text-body-sm font-semibold text-white">
                  {usuario.email.split("@")[0]}
                </div>
                <div className="truncate font-label text-label-sm text-m3-on-primary-container">
                  {ROL_LABEL[usuario.rol] ?? usuario.rol}
                </div>
              </div>
            </div>
          </ResponsiveSidebarShell>

          {/* Main — TopAppBar + body */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-sticky flex min-h-16 flex-wrap items-center gap-3 border-b border-m3-outline-variant bg-m3-surface px-4 py-2 sm:gap-4 lg:px-6">
              <MobileMenuButton />
              <ScopeBarWithContext items={navItems} />
              {usuario.rol !== "superadmin" && <EspacioSwitcher espacios={espacios} />}
              <div className="ml-auto flex items-center gap-3">
                <UserMenu email={usuario.email} rol={usuario.rol} />
              </div>
            </header>
            <main id="contenido" tabIndex={-1} className="flex-1 p-4 focus:outline-none lg:p-6">
              <div className="mx-auto w-full max-w-[1680px]">{children}</div>
            </main>
          </div>
        </div>
      </MobileNavProvider>
      </BreadcrumbProvider>
    </ProjectProvider>
    </ToastProvider>
  );
}
