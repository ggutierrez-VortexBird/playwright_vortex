"use client";

import Link from "next/link";
import type { ProyectoWithMetrics } from "@/types/proyecto";

interface ProyectoCardProps {
  proyecto: ProyectoWithMetrics;
  espacioNombre?: string;
  espacioColor?: string | null;
  onEdit?: (proyecto: ProyectoWithMetrics) => void;
  onDelete?: (proyecto: ProyectoWithMetrics) => void;
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

export function ProyectoCard({
  proyecto,
  espacioNombre,
  espacioColor,
  onEdit,
  onDelete,
  canEdit = false,
}: ProyectoCardProps) {
  return (
    <article
      className="group relative block w-full overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest text-left transition-colors hover:border-m3-outline"
      style={espacioColor ? { borderTopWidth: 3, borderTopColor: espacioColor } : undefined}
    >
      {/* Action buttons — only visible on hover */}
      {(canEdit || onEdit || onDelete) && (
        <div className="absolute right-3 top-3 z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {canEdit && onEdit && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(proyecto);
              }}
              className="rounded border border-m3-outline-variant bg-m3-surface-container-lowest px-2.5 py-1 font-label text-label-sm text-m3-on-surface hover:bg-m3-surface-container-high transition-colors"
            >
              Editar
            </button>
          )}
          {canEdit && onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(proyecto);
              }}
              className="rounded border border-m3-error bg-m3-surface-container-lowest px-2.5 py-1 font-label text-label-sm text-m3-error hover:bg-m3-error-container/20 transition-colors"
            >
              Eliminar
            </button>
          )}
        </div>
      )}

      <Link href={`/proyectos/${proyecto.id}/casos`} className="block no-underline">
        <div className="px-4 py-3.5">
          {espacioNombre && (
            <div className="font-label text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
              {espacioNombre}
            </div>
          )}
          <div className="mt-1 font-body text-body-lg font-semibold text-m3-on-surface">
            {proyecto.nombre}
          </div>
          <div className="mt-1 font-body text-body-sm text-m3-on-surface-variant">
            {proyecto.ambiente}
          </div>
        </div>
        <div className="flex gap-5 border-t border-m3-outline-variant bg-m3-surface-container px-4 py-3">
          <div>
            <div className="font-label text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
              Casos
            </div>
            <div className="mt-0.5 font-body text-body-lg font-semibold text-m3-on-surface">
              {proyecto.totalCasos}
            </div>
          </div>
          <div>
            <div className="font-label text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
              Conformes
            </div>
            <div className="mt-0.5 font-body text-body-lg font-semibold text-m3-on-tertiary-container">
              {proyecto.casosConformes}
            </div>
          </div>
          <div>
            <div className="font-label text-label-sm uppercase tracking-wide text-m3-on-surface-variant">
              No conformes
            </div>
            <div
              className={`mt-0.5 font-body text-body-lg font-semibold ${
                proyecto.casosNoConformes > 0 ? "text-m3-error" : "text-m3-on-surface"
              }`}
            >
              {proyecto.casosNoConformes}
            </div>
          </div>
        </div>
        <div className="flex justify-between gap-2.5 border-t border-m3-outline-variant px-4 py-2.5 font-body text-body-sm text-m3-on-surface-variant">
          <span>{proyecto.ambiente}</span>
          <span>{formatRelativeDate(proyecto.fechaUltimaEjecucion)}</span>
        </div>
      </Link>
    </article>
  );
}
