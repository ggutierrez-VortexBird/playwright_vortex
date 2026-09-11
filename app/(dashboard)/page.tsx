import Link from "next/link";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { listProyectosActivos } from "@/lib/proyectos/actions";
import { listCasos } from "@/lib/casos/actions";
import { listEjecuciones } from "@/lib/ejecuciones/queries";
import { EjecucionStatus } from "@/components/ejecuciones/ejecucion-status";

const ROL_LABEL: Record<string, string> = {
  superadmin: "Superadmin · acceso completo",
  admin: "Admin · administra sus espacios",
  tester: "Tester · acceso a sus proyectos asignados",
};

function formatFecha(date: Date): string {
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardHomePage() {
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  const [proyectos, casos, ejecuciones] = await Promise.all([
    listProyectosActivos(usuario),
    listCasos(undefined, usuario),
    listEjecuciones(undefined, usuario),
  ]);

  const totalEjecuciones = ejecuciones.length;
  const exitosas = ejecuciones.filter((e) => e.estado === "paso").length;
  const fallidas = ejecuciones.filter((e) => e.estado === "fallo").length;
  const tasaExito = totalEjecuciones > 0 ? Math.round((exitosas / totalEjecuciones) * 100) : null;
  const recientes = ejecuciones.slice(0, 6);

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-6 -mt-6 flex flex-wrap items-center gap-4 border-b border-m3-outline-variant bg-m3-surface px-6 py-5">
        <div>
          <h2 className="font-headline text-headline-lg text-m3-primary">
            Hola, {usuario?.email ?? "Usuario"}
          </h2>
          <span className="font-body text-body-sm text-m3-on-surface-variant">
            {usuario ? (ROL_LABEL[usuario.rol] ?? usuario.rol) : "—"}
          </span>
        </div>
        <span className="ml-auto" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm">
          <div className="font-label text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
            Proyectos
          </div>
          <div className="mt-2 font-headline text-[26px] font-bold leading-none text-m3-on-surface">
            {proyectos.length}
          </div>
        </div>
        <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm">
          <div className="font-label text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
            Casos de prueba
          </div>
          <div className="mt-2 font-headline text-[26px] font-bold leading-none text-m3-on-surface">
            {casos.length}
          </div>
        </div>
        <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm">
          <div className="font-label text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
            Ejecuciones
          </div>
          <div className="mt-2 font-headline text-[26px] font-bold leading-none text-m3-on-surface">
            {totalEjecuciones}
          </div>
        </div>
        <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm">
          <div className="font-label text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
            Tasa de éxito
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline text-[26px] font-bold leading-none text-m3-on-surface">
              {tasaExito !== null ? `${tasaExito}%` : "—"}
            </span>
            {totalEjecuciones > 0 && (
              <span className="font-label text-label-sm text-m3-on-surface-variant">
                {exitosas} ok · {fallidas} fallo{fallidas !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
        <div className="flex items-center justify-between border-b border-m3-outline-variant px-5 py-4">
          <h3 className="font-headline text-headline-md text-m3-primary">Actividad reciente</h3>
          <Link
            href="/ejecuciones"
            className="font-label text-label-sm font-semibold text-m3-secondary hover:underline"
          >
            Ver todas →
          </Link>
        </div>
        {recientes.length === 0 ? (
          <div className="px-5 py-10 text-center font-body text-body-md text-m3-on-surface-variant">
            Todavía no hay ejecuciones registradas.
          </div>
        ) : (
          <div>
            {recientes.map((ejec) => (
              <Link
                key={ejec.id}
                href={`/ejecuciones/${ejec.id}`}
                className="flex items-center gap-3.5 border-b border-m3-outline-variant px-5 py-3.5 text-inherit no-underline last:border-b-0 hover:bg-m3-surface-container-high"
              >
                <EjecucionStatus estado={ejec.estado} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-body text-body-md font-medium text-m3-on-surface">
                    {ejec.casoPrueba.nombre}
                  </div>
                  <div className="mt-0.5 font-mono-code text-mono-code text-m3-on-surface-variant">
                    {ejec.casoPrueba.proyecto.nombre} · {formatFecha(ejec.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
