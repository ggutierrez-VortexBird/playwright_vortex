import type { Metadata } from "next";
import Link from "next/link";
import { getSession, getUsuarioActual } from "@/lib/auth";
import { listProyectosActivos } from "@/lib/proyectos/actions";
import { listCasos } from "@/lib/casos/actions";
import { listEjecuciones } from "@/lib/ejecuciones/queries";
import { EjecucionStatus } from "@/components/ejecuciones/ejecucion-status";
import { KpiTile } from "@/components/ui/kpi-tile";
import {
  EjecucionesPorEspacioChartLazy,
  DistribucionResultadosChartLazy,
} from "@/components/dashboard/lazy-charts";
import { PageHeader } from "@/components/ui/page-header";
import { estadoLabel } from "@/lib/ejecuciones/estado";
import { formatFecha } from "@/lib/format";


export const metadata: Metadata = { title: "Inicio" };
// Un color distinto por estado; el significado también va en la leyenda con texto.
const ESTADO_TOKEN: Record<string, string> = {
  paso: "m3-tertiary",
  fallo: "m3-error",
  corriendo: "m3-info",
  errorMotor: "m3-warning",
  pendiente: "m3-primary-fixed-dim",
  cancelado: "m3-outline",
};

export default async function DashboardHomePage() {
  const session = await getSession();
  const usuario = await getUsuarioActual(session);

  const [proyectos, casos, { ejecuciones }] = await Promise.all([
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

  const porEstado = new Map<string, number>();
  for (const ejec of ejecuciones) {
    porEstado.set(ejec.estado, (porEstado.get(ejec.estado) ?? 0) + 1);
  }
  const estadosOrdenados = Array.from(porEstado.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-6">
      {/* Greeting — Issue #8: use nombre, not email */}
      <PageHeader
        title={`Hola, ${usuario?.nombre?.trim() || usuario?.email.split("@")[0] || "de nuevo"}`}
        subtitle={usuario?.email ?? "—"}
      />

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          label="Proyectos"
          value={proyectos.length}
          icon="folder_open"
          density="comfortable"
        />
        <KpiTile
          label="Casos de prueba"
          value={casos.length}
          icon="fact_check"
          density="comfortable"
        />
        <KpiTile
          label="Ejecuciones"
          value={totalEjecuciones}
          icon="play_circle"
          density="comfortable"
        />
        <KpiTile
          label="Tasa de éxito"
          value={tasaExito !== null ? `${tasaExito}%` : "—"}
          sub={
            totalEjecuciones > 0
              ? `${exitosas} ok · ${fallidas} fallo${fallidas !== 1 ? "s" : ""}`
              : undefined
          }
          icon="verified"
          accent={tasaExito !== null ? "success" : "secondary"}
          density="comfortable"
        />
      </div>

      {totalEjecuciones > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Executions by space */}
          <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-card">
            <h3 className="font-headline text-headline-sm text-m3-on-surface">Ejecuciones por espacio</h3>
            <p className="font-body text-body-sm text-m3-on-surface-variant">Total general</p>
            <div className="mt-2" aria-hidden="true" inert>
              <EjecucionesPorEspacioChartLazy data={espaciosOrdenados} />
            </div>
            <ul className="sr-only">
              {espaciosOrdenados.map((e) => (
                <li key={e.nombre}>
                  {e.nombre}: {e.total} {e.total === 1 ? "ejecución" : "ejecuciones"}
                </li>
              ))}
            </ul>
          </div>

          {/* Results distribution — Issue #21: use M3 tokens */}
          <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-5 shadow-card">
            <h3 className="font-headline text-headline-sm text-m3-on-surface">Distribución de resultados</h3>
            <p className="font-body text-body-sm text-m3-on-surface-variant">
              {totalEjecuciones} ejecuciones · todos los espacios
            </p>
            <div className="mt-6 overflow-hidden rounded-full bg-m3-surface-container" aria-hidden="true" inert>
              <DistribucionResultadosChartLazy
                data={estadosOrdenados.map(([estado, count]) => ({
                  estado,
                  count,
                  token: ESTADO_TOKEN[estado] ?? "m3-outline-variant",
                }))}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {estadosOrdenados.map(([estado, count]) => (
                <span key={estado} className="flex items-center gap-1.5 font-body text-body-sm text-m3-on-surface-variant">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{
                      backgroundColor: `rgb(var(--${ESTADO_TOKEN[estado] ?? "m3-outline-variant"}))`,
                    }}
                  />
                  {estadoLabel(estado, "ejecucion")}{" "}
                  <span className="font-semibold text-m3-on-surface">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card">
        <div className="flex items-center justify-between border-b border-m3-outline-variant px-5 py-4">
          <h3 className="font-headline text-headline-md text-m3-on-surface">Actividad reciente</h3>
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
                  {/* Issue #15: use font-body, not font-mono-code */}
                  <div className="mt-0.5 font-body text-body-sm text-m3-on-surface-variant">
                    {ejec.casoPrueba.proyecto.nombre} · {ejec.casoPrueba.proyecto.espacio.nombre} ·{" "}
                    {formatFecha(ejec.createdAt, { anio: false })}
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
