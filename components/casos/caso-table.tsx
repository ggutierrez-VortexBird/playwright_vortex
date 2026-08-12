"use client";

import { useState } from "react";
import type { CasoPruebaListItem } from "@/types/caso";

interface CasoTableProps {
  casos: CasoPruebaListItem[];
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
  canEdit?: boolean;
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateFileName(name: string | null, maxLen = 36): string {
  if (!name) return "—";
  if (name.length <= maxLen) return name;
  return "…" + name.slice(-(maxLen - 1));
}

function getEstadoPill(estado: CasoPruebaListItem["estado"]) {
  const map: Record<
    CasoPruebaListItem["estado"],
    { label: string; classes: string }
  > = {
    "sin ejecuciones": {
      label: "Sin ejecutar",
      classes: "text-ink-3 border-rule bg-paper",
    },
    paso: {
      label: "Aprobado",
      classes: "text-seal border-emerald-200 bg-emerald-50",
    },
    fallo: {
      label: "Falló",
      classes: "text-stamp border-red-200 bg-red-50",
    },
    reparado: {
      label: "Reparado",
      classes: "text-amber border-amber-200 bg-amber-50",
    },
    errorMotor: {
      label: "Error motor",
      classes: "text-client border-orange-200 bg-orange-50",
    },
  };
  return map[estado];
}

export function CasoTable({ casos, onEdit, onDelete, canEdit = false }: CasoTableProps) {
  if (casos.length === 0) {
    return (
      <div className="rounded-lg border border-rule bg-surface p-8 text-center">
        <p className="text-ink-3">No hay casos de prueba</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-rule bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
              Código
            </th>
            <th className="px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
              Nombre
            </th>
            <th className="px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
              Responsable
            </th>
            <th className="px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
              Script
            </th>
            <th className="px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
              Estado
            </th>
            <th className="px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
              Última ejecución
            </th>
            <th className="px-4 py-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
              Pasos
            </th>
            <th className="px-4 py-3 text-right font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
              Ejecutar
            </th>
            {canEdit && (
              <th className="px-4 py-3 text-right font-mono text-[10.5px] font-medium uppercase tracking-wider text-ink-3 border-b border-rule">
                Acciones
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {casos.map((caso) => {
            const pill = getEstadoPill(caso.estado);
            return (
              <CasoRow
                key={caso.id}
                caso={caso}
                pillClasses={pill.classes}
                pillLabel={pill.label}
                canEdit={canEdit}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            );
          })}
        </tbody>
      </table>
      <style jsx>{`
        @media (hover: none) {
          .media-hover\\:visible {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}

interface CasoRowProps {
  caso: CasoPruebaListItem;
  pillClasses: string;
  pillLabel: string;
  canEdit: boolean;
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
}

function CasoRow({ caso, pillClasses, pillLabel, canEdit, onEdit, onDelete }: CasoRowProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEjecutar() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/ejecuciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ casoPruebaId: caso.id }),
      });
      if (res.status === 401 || res.status === 403) {
        setError("Sin permisos");
        return;
      }
      if (res.status === 404) {
        setError("Caso no encontrado");
        return;
      }
      if (res.status === 409) {
        setError("Ya hay una ejecución en curso");
        return;
      }
      if (!res.ok) {
        setError("Error al ejecutar");
        return;
      }
      const data = await res.json();
      // Redirigir al detalle de la ejecución para ver el progreso en vivo
      window.location.href = `/ejecuciones/${data.id}`;
    } catch {
      setError("Error de conexión");
    } finally {
      setRunning(false);
    }
  }

  return (
    <tr
      className="group border-b border-rule-soft last:border-b-0 hover:bg-[#F7FAFB]"
    >
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-ink-2">{caso.codigo}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-ink">{caso.nombre}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-ink-3">{caso.responsableEmail}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-ink-2" title={caso.scriptFileName || undefined}>
          {truncateFileName(caso.scriptFileName)}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${pillClasses}`}
        >
          {pillLabel}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-ink-3">
          {formatDate(caso.fechaUltimaEjecucion)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="font-mono text-xs text-ink-3">
          {caso.pasosCount ?? 0}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEjecutar();
            }}
            disabled={running}
            aria-label={`Ejecutar caso ${caso.codigo}`}
            className="inline-flex items-center gap-1.5 rounded border border-client bg-client px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-client/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "⏳ Lanzando…" : "▶ Ejecutar"}
          </button>
          {error && (
            <span className="font-mono text-[10px] text-stamp">{error}</span>
          )}
        </div>
      </td>
      {canEdit && (
        <td className="px-4 py-3">
          <div className="flex justify-end gap-2">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(caso);
                }}
                aria-label="Editar"
                className="invisible group-hover:visible rounded border border-rule px-2 py-1 text-xs text-ink hover:bg-rule-soft media-hover:visible"
              >
                Editar
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(caso);
                }}
                aria-label="Eliminar"
                className="invisible group-hover:visible rounded border border-stamp px-2 py-1 text-xs text-stamp hover:bg-red-50 media-hover:visible"
              >
                Eliminar
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
