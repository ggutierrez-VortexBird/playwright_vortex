"use client";

import { useState } from "react";
import Link from "next/link";
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

function getEstadoBadge(
  estado: CasoPruebaListItem["estado"],
  primerPasoFallidoNumero?: number | null,
) {
  const map: Record<
    CasoPruebaListItem["estado"],
    { label: string; className: string }
  > = {
    "sin ejecuciones": {
      label: "Sin ejecutar",
      className:
        "bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant",
    },
    paso: {
      label: "Aprobado",
      className:
        "bg-m3-tertiary-container/15 text-m3-on-tertiary-container border border-m3-tertiary-container/40",
    },
    fallo: {
      label:
        primerPasoFallidoNumero != null
          ? `Falló en el paso ${primerPasoFallidoNumero}`
          : "Falló",
      className: "bg-m3-error-container/60 text-m3-error border border-m3-error/25",
    },
    reparado: {
      label: "Reparado",
      className:
        "bg-m3-secondary-container/25 text-m3-on-secondary-container border border-m3-secondary/30",
    },
    errorMotor: {
      label: "Error motor",
      className: "bg-m3-error-container/60 text-m3-error border border-m3-error/25",
    },
  };
  // Fallback for unknown estados (e.g. "pendiente", "corriendo") coming from
  // legacy rows, API/DB drift, or future states not yet mapped. Without this
  // guard, reading `badge.className` would throw "Cannot read properties of
  // undefined".
  return (
    map[estado] ?? {
      label: estado,
      className:
        "bg-m3-surface-container-high text-m3-on-surface-variant border border-m3-outline-variant",
    }
  );
}

export function CasoTable({ casos, onEdit, onDelete, canEdit = false }: CasoTableProps) {
  if (casos.length === 0) {
    return (
      <div className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-8 text-center">
        <p className="font-body text-body-md text-m3-on-surface-variant">
          No hay casos de prueba
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-m3-outline-variant bg-m3-surface-container">
            <tr>
              {[
                "Código",
                "Nombre",
                "Responsable",
                "Script",
                "Estado",
                "Última ejecución",
                "Pasos",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 font-label text-label-sm font-semibold uppercase tracking-wide text-m3-on-surface-variant"
                >
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-label text-label-sm font-semibold uppercase tracking-wide text-m3-on-surface-variant">
                Ejecutar
              </th>
              {canEdit && (
                <th className="px-4 py-3 text-right font-label text-label-sm font-semibold uppercase tracking-wide text-m3-on-surface-variant">
                  Acciones
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-outline-variant">
            {casos.map((caso) => {
              const badge = getEstadoBadge(caso.estado, caso.primerPasoFallidoNumero);
              return (
                <CasoRow
                  key={caso.id}
                  caso={caso}
                  badgeClassName={badge.className}
                  badgeLabel={badge.label}
                  canEdit={canEdit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              );
            })}
          </tbody>
        </table>
      </div>
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
  badgeClassName: string;
  badgeLabel: string;
  canEdit: boolean;
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
}

function CasoRow({ caso, badgeClassName, badgeLabel, canEdit, onEdit, onDelete }: CasoRowProps) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRowClick() {
    if (caso.ultimaEjecucionId) {
      window.location.href = `/ejecuciones/${caso.ultimaEjecucionId}`;
    }
  }

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

  const hasEjecucion = !!caso.ultimaEjecucionId;

  return (
    <tr
      className={`group${hasEjecucion ? " cursor-pointer hover:bg-m3-surface-container-high" : ""}`}
      onClick={handleRowClick}
    >
      <td className="px-4 py-3">
        <Link
          href={`/casos/${caso.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono-code text-mono-code text-m3-on-surface hover:text-m3-secondary hover:underline"
        >
          {caso.codigo}
        </Link>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/casos/${caso.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-body text-body-md text-m3-on-surface hover:text-m3-secondary hover:underline"
        >
          {caso.nombre}
        </Link>
      </td>
      <td className="px-4 py-3 font-body text-body-sm text-m3-on-surface-variant">
        {caso.responsableEmail}
      </td>
      <td
        className="px-4 py-3 font-mono-code text-mono-code text-m3-on-surface-variant"
        title={caso.scriptFileName || undefined}
      >
        {truncateFileName(caso.scriptFileName)}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label text-label-sm font-medium ${badgeClassName}`}
        >
          {badgeLabel}
        </span>
      </td>
      <td className="px-4 py-3 font-body text-body-sm text-m3-on-surface-variant">
        {formatDate(caso.fechaUltimaEjecucion)}
      </td>
      <td className="px-4 py-3 font-body text-body-sm text-m3-on-surface-variant">
        {caso.pasosCount ?? 0}
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
            className="rounded border border-m3-secondary px-2.5 py-1 font-label text-label-sm font-medium text-m3-secondary transition-colors hover:bg-m3-secondary-fixed/20 disabled:opacity-50"
          >
            {running ? "Lanzando…" : "Ejecutar"}
          </button>
          {error && (
            <span className="font-label text-label-sm text-m3-error">{error}</span>
          )}
        </div>
      </td>
      {canEdit && (
        <td className="px-4 py-3">
          <div className="flex justify-end gap-2">
            <Link
              href={`/casos/${caso.id}?editarScript=1`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Editar script de ${caso.codigo}`}
              title="Editar script"
              data-testid="editar-script-row-action"
              className="invisible group-hover:visible flex items-center gap-1 rounded border border-m3-outline-variant px-2 py-1 font-label text-label-sm text-m3-on-surface hover:bg-m3-surface-container-high media-hover:visible"
            >
              <span className="material-symbols-outlined text-[14px]">terminal</span>
              Script
            </Link>
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(caso);
                }}
                aria-label="Editar"
                className="invisible group-hover:visible rounded border border-m3-outline-variant px-2 py-1 font-label text-label-sm text-m3-on-surface hover:bg-m3-surface-container-high media-hover:visible"
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
                className="invisible group-hover:visible rounded border border-m3-error px-2 py-1 font-label text-label-sm text-m3-error hover:bg-m3-error-container/20 media-hover:visible"
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
