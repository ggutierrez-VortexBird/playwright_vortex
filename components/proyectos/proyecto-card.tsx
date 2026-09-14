"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProyectoWithMetrics } from "@/types/proyecto";

interface ProyectoCardProps {
  proyecto: ProyectoWithMetrics;
  espacioNombre?: string;
  espacioColor?: string | null;
  onEdit?: (proyecto: ProyectoWithMetrics) => void;
  onDelete?: (proyecto: ProyectoWithMetrics) => void;
  onManageTesters?: (proyecto: ProyectoWithMetrics) => void;
  canEdit?: boolean;
}

function formatRelativeDate(dateString: string | null): string {
  if (!dateString) return "sin ejecuciones";
  const date = new Date(dateString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (minutes < 1) return "hace instantes";
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours} h`;
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} d`;
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function codigoProyecto(id: string): string {
  return `#PRY-${id.replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

function ambienteDotColor(ambiente: string): string {
  const a = ambiente.toLowerCase();
  if (a.includes("prod")) return "bg-sky-500";
  if (a.includes("stag") || a.includes("qa")) return "bg-purple-500";
  if (a.includes("dev")) return "bg-amber-500";
  return "bg-m3-outline";
}

export function ProyectoCard({
  proyecto,
  espacioNombre,
  espacioColor,
  onEdit,
  onDelete,
  onManageTesters,
  canEdit = false,
}: ProyectoCardProps) {
  const [hover, setHover] = useState(false);
  const color = proyecto.color ?? espacioColor ?? "#64748b";
  const evaluados = proyecto.casosConformes + proyecto.casosNoConformes;
  const tasaExito = evaluados > 0 ? Math.round((proyecto.casosConformes / evaluados) * 100) : null;

  const tasaColor =
    tasaExito === null
      ? "text-m3-on-surface-variant"
      : tasaExito < 50
      ? "text-m3-error"
      : tasaExito < 80
      ? "text-m3-secondary"
      : "text-m3-success";
  const barColor =
    tasaExito === null
      ? "bg-m3-outline-variant"
      : tasaExito < 50
      ? "bg-m3-error"
      : tasaExito < 80
      ? "bg-m3-secondary-container"
      : "bg-m3-success";

  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card transition-shadow hover:shadow-md">
      {/* Cabecera coloreada */}
      <div className="flex flex-col p-4 pb-5 text-white" style={{ backgroundColor: color }}>
        <div className="mb-2.5 flex items-center justify-between text-xs">
          <span className="rounded-md bg-black/20 px-2.5 py-0.5 font-mono-code text-[11px] font-semibold tracking-wider text-white/90">
            {codigoProyecto(proyecto.id)}
          </span>
          {canEdit && (onManageTesters || onEdit || onDelete) && (
            <div className="flex items-center gap-1">
              {onManageTesters && (
                <button
                  onClick={() => onManageTesters(proyecto)}
                  className="rounded-md p-1 text-white/90 transition hover:bg-black/20 hover:text-white"
                  title="Testers"
                  aria-label="Testers del proyecto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(proyecto)}
                  className="rounded-md p-1 text-white/90 transition hover:bg-black/20 hover:text-white"
                  title="Editar"
                  aria-label="Editar proyecto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(proyecto)}
                  className="rounded-md p-1 text-white/90 transition hover:bg-rose-950/40 hover:text-white"
                  title="Eliminar"
                  aria-label="Eliminar proyecto"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
        {espacioNombre && (
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-white/80">{espacioNombre}</p>
        )}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <h3 className="truncate text-xl font-bold tracking-tight text-white">{proyecto.nombre}</h3>
          <span className="shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
            {proyecto.ambiente}
          </span>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex flex-1 flex-col justify-between gap-5 p-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
            <span className="text-m3-on-surface-variant">Tasa de éxito</span>
            <span className={tasaColor}>{tasaExito !== null ? `${tasaExito}%` : "—"}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-m3-surface-container">
            <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${tasaExito ?? 0}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl border border-m3-outline-variant bg-m3-surface-container-low px-3 py-3 text-center">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant">Casos</span>
            <span className="text-lg font-bold leading-tight text-m3-on-surface">{proyecto.totalCasos}</span>
          </div>
          <div className="border-x border-m3-outline-variant">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant">Conformes</span>
            <span className="text-lg font-bold leading-tight text-m3-success">{proyecto.casosConformes}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-m3-on-surface-variant">No conf.</span>
            <span
              className={`text-lg font-bold leading-tight ${
                proyecto.casosNoConformes > 0 ? "text-m3-error" : "text-m3-on-surface"
              }`}
            >
              {proyecto.casosNoConformes}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-m3-outline-variant pt-3 text-xs text-m3-on-surface-variant">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${ambienteDotColor(proyecto.ambiente)}`} />
            <span className="truncate font-medium">{proyecto.ambiente}</span>
            <span className="shrink-0">•</span>
            <span className="shrink-0">{formatRelativeDate(proyecto.fechaUltimaEjecucion)}</span>
          </div>
          <Link
            href={`/proyectos/${proyecto.id}/casos`}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ backgroundColor: hover ? color : undefined }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-m3-inverse-surface px-3.5 py-1.5 text-xs font-semibold text-m3-inverse-on-surface no-underline shadow-sm transition duration-200"
          >
            Ver
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  );
}
