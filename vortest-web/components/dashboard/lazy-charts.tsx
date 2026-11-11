"use client";

/** Wrappers cliente que cargan Recharts bajo demanda (next/dynamic ssr:false no sirve en Server Components). */
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { EspacioDatum } from "./ejecuciones-por-espacio-chart";
import type { EstadoDatum } from "./distribucion-resultados-chart";

const EjecucionesPorEspacioChartDynamic = dynamic(
  () =>
    import("./ejecuciones-por-espacio-chart").then((m) => m.EjecucionesPorEspacioChart),
  { ssr: false, loading: () => <Skeleton className="h-[140px] w-full" /> },
);

const DistribucionResultadosChartDynamic = dynamic(
  () =>
    import("./distribucion-resultados-chart").then((m) => m.DistribucionResultadosChart),
  { ssr: false, loading: () => <Skeleton className="h-4 w-full rounded-full" /> },
);

export function EjecucionesPorEspacioChartLazy({ data }: { data: EspacioDatum[] }) {
  return <EjecucionesPorEspacioChartDynamic data={data} />;
}

export function DistribucionResultadosChartLazy({ data }: { data: EstadoDatum[] }) {
  return <DistribucionResultadosChartDynamic data={data} />;
}
