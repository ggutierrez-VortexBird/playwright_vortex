"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from "recharts";

export interface EstadoDatum {
  estado: string;
  count: number;
  token: string;
}

interface DistribucionResultadosChartProps {
  data: EstadoDatum[];
}

/** Barra horizontal apilada única — cada estado ocupa su proporción del total. */
export function DistribucionResultadosChart({ data }: DistribucionResultadosChartProps) {
  const row: Record<string, string | number> = { name: "total" };
  for (const d of data) row[d.estado] = d.count;

  return (
    <ResponsiveContainer width="100%" height={16}>
      <BarChart
        data={[row]}
        layout="vertical"
        stackOffset="expand"
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" hide />
        {data.map((d) => (
          <Bar key={d.estado} dataKey={d.estado} stackId="resultados" fill={`var(--${d.token})`} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
