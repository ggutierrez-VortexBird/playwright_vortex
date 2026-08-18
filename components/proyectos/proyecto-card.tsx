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
      className="proj-card group relative"
      style={espacioColor ? { borderTopColor: espacioColor } : undefined}
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
              className="btn"
              style={{ padding: "4px 10px", fontSize: 12 }}
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
              className="btn"
              style={{
                padding: "4px 10px",
                fontSize: 12,
                color: "var(--stamp)",
                borderColor: "var(--stamp)",
              }}
            >
              Eliminar
            </button>
          )}
        </div>
      )}

      <Link
        href={`/proyectos/${proyecto.id}/casos`}
        className="block"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div
          className="pc-top"
          style={espacioColor ? { borderTopColor: espacioColor } : undefined}
        >
          {espacioNombre && (
            <div className="pc-client">{espacioNombre}</div>
          )}
          <div className="pc-name">{proyecto.nombre}</div>
          <div
            className="tmeta"
            style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}
          >
            {proyecto.ambiente}
          </div>
        </div>
        <div className="pc-stats">
          <div>
            <div className="k">Casos</div>
            <div className="v">{proyecto.totalCasos}</div>
          </div>
          <div>
            <div className="k">Conformes</div>
            <div className="v" style={{ color: "var(--seal)" }}>
              {proyecto.casosConformes}
            </div>
          </div>
          <div>
            <div className="k">No conformes</div>
            <div
              className="v"
              style={{
                color:
                  proyecto.casosNoConformes > 0 ? "var(--stamp)" : "var(--ink)",
              }}
            >
              {proyecto.casosNoConformes}
            </div>
          </div>
        </div>
        <div className="pc-foot">
          <span>{proyecto.ambiente}</span>
          <span>{formatRelativeDate(proyecto.fechaUltimaEjecucion)}</span>
        </div>
      </Link>
    </article>
  );
}
