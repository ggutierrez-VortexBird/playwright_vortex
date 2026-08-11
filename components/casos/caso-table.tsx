"use client";

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
              <tr
                key={caso.id}
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
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium ${pill.classes}`}
                  >
                    {pill.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs text-ink-3">
                    {formatDate(caso.fechaUltimaEjecucion)}
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
                          className="rounded border border-rule px-2 py-1 text-xs text-ink hover:bg-rule-soft"
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
                          className="rounded border border-stamp px-2 py-1 text-xs text-stamp hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
