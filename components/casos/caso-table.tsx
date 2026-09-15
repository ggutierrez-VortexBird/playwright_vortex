"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CasoPruebaListItem } from "@/types/caso";

const PAGE_SIZE = 10;

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

const ORIGEN_LABEL: Record<CasoPruebaListItem["origen"], string> = {
  subirScript: "subido",
  grabador: "grabado",
  mixto: "mixto",
};

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
      className: "bg-m3-surface-container-high text-m3-on-surface-variant",
    },
    paso: {
      label: "Pasó",
      className: "bg-m3-success-container text-m3-success",
    },
    fallo: {
      label:
        primerPasoFallidoNumero != null
          ? `Falló en el paso ${primerPasoFallidoNumero}`
          : "Falló",
      className: "bg-m3-danger-container text-m3-error",
    },
    reparado: {
      label: "Reparado",
      className: "bg-m3-reparado-container text-m3-reparado",
    },
    errorMotor: {
      label: "Error motor",
      className: "bg-m3-danger-container text-m3-error",
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
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(casos.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPages);
  const casosPagina = useMemo(
    () => casos.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE),
    [casos, paginaActual]
  );

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
    <div className="overflow-hidden rounded-2xl border border-m3-outline-variant bg-m3-surface-container-lowest shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-m3-outline-variant bg-m3-surface-container">
            <tr>
              {["Código", "Caso", "Responsable", "Estado", "Última ejecución"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 font-label text-label-sm font-semibold uppercase tracking-wide text-m3-on-surface-variant"
                >
                  {h}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-label text-label-sm font-semibold uppercase tracking-wide text-m3-on-surface-variant">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-outline-variant">
            {casosPagina.map((caso) => {
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

      <div className="flex flex-col items-center justify-between gap-4 border-t border-m3-outline-variant px-4 py-3 text-xs text-m3-on-surface-variant sm:flex-row">
        <p>
          Mostrando <span className="font-semibold text-m3-on-surface">{casosPagina.length}</span> de{" "}
          <span className="font-semibold text-m3-on-surface">{casos.length}</span> casos registrados
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={paginaActual <= 1}
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-medium text-m3-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="rounded-lg border border-m3-info bg-m3-info-container px-3 py-1.5 font-bold text-m3-info">
            {paginaActual}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={paginaActual >= totalPages}
            className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest px-3 py-1.5 font-medium text-m3-on-surface-variant disabled:cursor-not-allowed disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
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
          className="font-body text-body-md font-semibold text-m3-on-surface hover:text-m3-secondary hover:underline"
        >
          {caso.nombre}
        </Link>
        <div className="font-body text-body-sm text-m3-on-surface-variant">
          {ORIGEN_LABEL[caso.origen]}
        </div>
        {caso.parentCaseCodigo && (
          <div className="mt-1 font-label text-label-sm text-m3-secondary">
            Requiere {caso.parentCaseCodigo}
          </div>
        )}
      </td>
      <td className="px-4 py-3 font-body text-body-sm text-m3-on-surface-variant">
        {caso.responsableEmail}
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
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEjecutar();
            }}
            disabled={running}
            aria-label={`Ejecutar caso ${caso.codigo}`}
            title={running ? "Lanzando…" : "Ejecutar"}
            className="rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container-high hover:text-m3-success disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.5 3.5A1 1 0 003 4.4v11.2a1 1 0 001.5.87l10-5.6a1 1 0 000-1.74l-10-5.6a1 1 0 00-1-.06z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          {canEdit && (
            <Link
              href={`/casos/${caso.id}?editarScript=1`}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Editar script de ${caso.codigo}`}
              title="Editar script"
              data-testid="editar-script-row-action"
              className="rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container-high hover:text-m3-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m7 9 3 3-3 3M13 15h4" />
              </svg>
            </Link>
          )}
          {canEdit && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(caso);
              }}
              aria-label="Editar"
              title="Editar"
              className="rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container-high hover:text-m3-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          )}
          {canEdit && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(caso);
              }}
              aria-label="Eliminar"
              title="Eliminar"
              className="rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-danger-container hover:text-m3-error"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          {error && <span className="font-label text-label-sm text-m3-error">{error}</span>}
        </div>
      </td>
    </tr>
  );
}
