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

const ESTADO_LABEL: Record<string, string> = {
  paso: "Pasó",
  fallo: "Falló",
  reparado: "Reparado",
  corriendo: "Corriendo",
  pendiente: "Pendiente",
  errorMotor: "Error motor",
  cancelado: "Cancelado",
};

const ESTADO_COLOR: Record<string, string> = {
  paso: "#12805c",
  fallo: "#ba1a1a",
  reparado: "#7c4fd6",
  corriendo: "#2f5fbd",
  pendiente: "#9aa0a6",
  errorMotor: "#9aa0a6",
  cancelado: "#9aa0a6",
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
  const resueltas = exitosas + fallidas;
  const tasaExito = resueltas > 0 ? Math.round((exitosas / resueltas) * 100) : null;
  const recientes = ejecuciones.slice(0, 6);

  const porEspacio = new Map<string, { nombre: string; color: string; total: number }>();
  for (const ejec of ejecuciones) {
    const espacio = ejec.casoPrueba.proyecto.espacio;
    const entry = porEspacio.get(espacio.id) ?? { nombre: espacio.nombre, color: espacio.color, total: 0 };
    entry.total += 1;
    porEspacio.set(espacio.id, entry);
  }
  const espaciosOrdenados = Array.from(porEspacio.values()).sort((a, b) => b.total - a.total);
  const maxPorEspacio = Math.max(1, ...espaciosOrdenados.map((e) => e.total));

  const porEstado = new Map<string, number>();
  for (const ejec of ejecuciones) {
    porEstado.set(ejec.estado, (porEstado.get(ejec.estado) ?? 0) + 1);
  }
  const estadosOrdenados = Array.from(porEstado.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-headline text-headline-lg text-m3-primary">
          Hola, {usuario?.email ?? "Usuario"}
        </h2>
        <p className="mt-1 font-body text-body-md text-m3-on-surface-variant">
          {usuario ? (ROL_LABEL[usuario.rol] ?? usuario.rol) : "—"}
        </p>
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

      {totalEjecuciones > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm">
            <h3 className="font-headline text-headline-sm text-m3-on-surface">Ejecuciones por espacio</h3>
            <p className="font-body text-body-sm text-m3-on-surface-variant">Total general</p>
            <div className="mt-4 flex flex-col gap-3">
              {espaciosOrdenados.map((e) => (
                <div key={e.nombre} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 flex-none rounded-sm"
                    style={{ backgroundColor: e.color }}
                  />
                  <span className="w-32 flex-none truncate font-body text-body-sm text-m3-on-surface">
                    {e.nombre}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-m3-surface-container">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (e.total / maxPorEspacio) * 100)}%`,
                        backgroundColor: e.color,
                      }}
                    />
                  </div>
                  <span className="w-8 flex-none text-right font-label text-label-sm font-semibold text-m3-on-surface">
                    {e.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-sm">
            <h3 className="font-headline text-headline-sm text-m3-on-surface">Distribución de resultados</h3>
            <p className="font-body text-body-sm text-m3-on-surface-variant">
              {totalEjecuciones} ejecuciones · todos los espacios
            </p>
            <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full bg-m3-surface-container">
              {estadosOrdenados.map(([estado, count]) => (
                <span
                  key={estado}
                  style={{
                    width: `${(count / totalEjecuciones) * 100}%`,
                    backgroundColor: ESTADO_COLOR[estado] ?? "#9aa0a6",
                  }}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {estadosOrdenados.map(([estado, count]) => (
                <span key={estado} className="flex items-center gap-1.5 font-body text-body-sm text-m3-on-surface-variant">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: ESTADO_COLOR[estado] ?? "#9aa0a6" }}
                  />
                  {ESTADO_LABEL[estado] ?? estado} <span className="font-semibold text-m3-on-surface">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

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
                    {ejec.casoPrueba.proyecto.nombre} · {ejec.casoPrueba.proyecto.espacio.nombre} ·{" "}
                    {formatFecha(ejec.createdAt)}
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
