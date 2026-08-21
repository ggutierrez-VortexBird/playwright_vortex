import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listEspacios, getEspacioById } from "@/lib/espacios/actions";
import { listProyectosActivos } from "@/lib/proyectos/actions";
import { ClientBand } from "@/components/ui/client-band";
import { EspacioSwitcher } from "@/components/ui/espacio-switcher";
import { ProyectoSwitcher } from "@/components/ui/proyecto-switcher";
import { ProjectProvider } from "@/components/project-context";
import { ScopeBarWithContext } from "@/components/scope-bar-with-context";

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id?: string }>;
}

const NAV_ITEMS = [
  { href: "/espacios", label: "Espacios", color: "var(--client)" },
  { href: "/proyectos", label: "Proyectos", color: "var(--seal)" },
  { href: "/casos", label: "Casos", color: "var(--amber)" },
  { href: "/ejecuciones", label: "Ejecuciones", color: "var(--param)" },
  { href: "/credenciales", label: "Credenciales", color: "var(--client)" },
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
      <div className="flex min-h-screen bg-paper">
        {/* Rail — mockup dark sidebar */}
        <aside className="rail">
          <ClientBand espacioColor={espacio?.color ?? null} />
          <div className="brand">
            <Image
              src="/icons/logo.svg"
              alt="QAtheApp"
              width={260}
              height={75}
              priority
            />
            <p>Automatización de pruebas</p>
          </div>
          <nav className="nav">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href}>
                <span className="dot" style={{ color: item.color }} />
                {item.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-white/10 px-5 py-3">
            <ProyectoSwitcher proyectos={proyectos} />
          </div>
          <div className="rail-foot">
            <div className="truncate" style={{ color: "#9FB2C2" }}>
              {usuario.email}
            </div>
            <div style={{ marginTop: 2 }}>{usuario.rol}</div>
            <div style={{ marginTop: 10, color: "#7D91A3" }}>
              Ambiente QA
              <br />
              Playwright 1.62.1
            </div>
            <form action="/api/logout" method="post" className="mt-3">
              <button
                type="submit"
                className="btn w-full"
                style={{
                  justifyContent: "center",
                  fontSize: 11,
                  padding: "6px 10px",
                  borderRadius: 4,
                  background: "linear-gradient(90deg, rgb(250, 182, 98), rgb(243, 155, 43))",
                  borderColor: "rgb(243, 155, 43)",
                  color: "#000",
                }}
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </aside>

        {/* Main — topbar + body */}
        <div className="flex flex-1 flex-col">
          <header
            className="topbar"
            style={{ background: "var(--ink)", color: "#fff" }}
          >
            <ScopeBarWithContext />
            <EspacioSwitcher espacios={espacios} />
            <span className="spacer" />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </ProjectProvider>
  );
}
