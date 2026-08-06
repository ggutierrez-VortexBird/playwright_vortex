"use client";

import type { ProyectoWithMetrics } from "@/types/proyecto";

interface ProyectoCardProps {
  proyecto: ProyectoWithMetrics;
  espacioNombre?: string;
  onEdit?: (proyecto: ProyectoWithMetrics) => void;
  onDelete?: (proyecto: ProyectoWithMetrics) => void;
  canEdit?: boolean;
}

export function ProyectoCard({
  proyecto,
  espacioNombre,
  onEdit,
  onDelete,
  canEdit = false,
}: ProyectoCardProps) {
  function formatDate(dateString: string | null): string {
    if (!dateString) return "Sin ejecuciones";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="proj-card group rounded-lg border border-rule bg-surface p-4 transition-colors hover:border-ink-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          {/* Chip de espacio */}
          {espacioNombre && (
            <span className="inline-flex w-fit items-center rounded-full bg-rule-soft px-2 py-0.5 text-xs text-ink-2">
              {espacioNombre}
            </span>
          )}
          {/* Nombre del proyecto */}
          <h3 className="text-lg font-semibold text-ink">{proyecto.nombre}</h3>
          {/* Ambiente */}
          <span className="text-sm text-ink-2">{proyecto.ambiente}</span>
        </div>

        {/* Action buttons - only visible on hover or if canEdit */}
        {(canEdit || onEdit || onDelete) && (
          <div className="relative z-10 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            {canEdit && onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(proyecto);
                }}
                className="rounded border border-rule px-2 py-1 text-xs text-ink hover:bg-rule-soft"
              >
                Editar
              </button>
            )}
            {canEdit && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(proyecto);
                }}
                className="rounded border border-stamp px-2 py-1 text-xs text-stamp hover:bg-red-50"
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metrics */}
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-rule pt-4">
        {/* Total casos */}
        <div className="text-center">
          <p className="text-2xl font-bold text-ink">{proyecto.totalCasos}</p>
          <p className="text-xs text-ink-3">Total casos</p>
        </div>
        {/* Casos conformes */}
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{proyecto.casosConformes}</p>
          <p className="text-xs text-ink-3">Conformes</p>
        </div>
        {/* Casos no conformes */}
        <div className="text-center">
          <p className="text-2xl font-bold text-red-600">{proyecto.casosNoConformes}</p>
          <p className="text-xs text-ink-3">No conformes</p>
        </div>
      </div>

      {/* Fecha última ejecución */}
      <div className="mt-3 text-center">
        <p className="text-xs text-ink-3">
          Última ejecución: {formatDate(proyecto.fechaUltimaEjecucion)}
        </p>
      </div>

      {/* Link to casos */}
      <div className="mt-3 border-t border-rule pt-3 text-center">
        <a
          href={`/proyectos/${proyecto.id}/casos`}
          className="inline-flex items-center gap-1 text-sm font-medium text-client hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          Ver casos
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-right"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>

    </div>
  );
}
