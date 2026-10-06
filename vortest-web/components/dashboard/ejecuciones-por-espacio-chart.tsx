"use client";

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";

export interface EspacioDatum {
  nombre: string;
  color: string;
  total: number;
}

interface EjecucionesPorEspacioChartProps {
  data: EspacioDatum[];
}

export function EjecucionesPorEspacioChart({ data }: EjecucionesPorEspacioChartProps) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(140, data.length * 44)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="nombre"
          width={128}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 13, fill: "var(--m3-on-surface)" }}
        />
        <Tooltip
          cursor={{ fill: "var(--m3-surface-container)" }}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--m3-outline-variant)",
            fontSize: 13,
          }}
        />
        <Bar dataKey="total" radius={[4, 4, 4, 4]} barSize={10}>
          {data.map((d) => (
            <Cell key={d.nombre} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
