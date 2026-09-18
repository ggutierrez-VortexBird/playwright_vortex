"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
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
    { label: string; tone: StatusBadgeTone; className?: string }
  > = {
    "sin ejecuciones": {
      label: "Sin ejecutar",
      tone: "neutral",
    },
    paso: {
      label: "Pasó",
      tone: "success",
    },
    fallo: {
      label:
        primerPasoFallidoNumero != null
          ? `Falló en el paso ${primerPasoFallidoNumero}`
          : "Falló",
      tone: "error",
    },
    reparado: {
      label: "Reparado",
      tone: "reparado",
    },
    errorMotor: {
      label: "Error motor",
      tone: "error",
    },
  };
  // Fallback for unknown estados (e.g. "pendiente", "corriendo") coming from
  // legacy rows, API/DB drift, or future states not yet mapped. Without this
  // guard, reading `badge.tone` would throw "Cannot read properties of
  // undefined".
  return (
    map[estado] ?? {
      label: estado,
      tone: "neutral" as StatusBadgeTone,
      className: "border border-m3-outline-variant",
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
    return <EmptyState icon="fact_check" title="No hay casos de prueba" />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card">
      {/* Tabla — md y superior */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left">
          <thead className="border-b border-m3-outline-variant bg-m3-surface-container">
            <tr>
              {["Código", "Caso", "Responsable", "Estado", "Última ejecución"].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 font-label text-label-sm font-semibold text-m3-on-surface-variant"
                >
                  {h}
                </th>
              ))}
              <th className="px-5 py-3 text-left font-label text-label-sm font-semibold text-m3-on-surface-variant">
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
                  badgeTone={badge.tone}
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

      {/* Tarjetas — móvil */}
      <div className="flex flex-col divide-y divide-m3-outline-variant md:hidden">
        {casosPagina.map((caso) => {
          const badge = getEstadoBadge(caso.estado, caso.primerPasoFallidoNumero);
          return (
            <CasoCard
              key={caso.id}
              caso={caso}
              badgeTone={badge.tone}
              badgeClassName={badge.className}
              badgeLabel={badge.label}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </div>

      <div className="flex flex-col items-center justify-between gap-4 border-t border-m3-outline-variant px-4 py-3 text-xs text-m3-on-surface-variant sm:flex-row">
        <p>
          Mostrando <span className="font-semibold text-m3-on-surface">{casosPagina.length}</span> de{" "}
          <span className="font-semibold text-m3-on-surface">{casos.length}</span> casos registrados
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={paginaActual <= 1}
          >
            Anterior
          </Button>
          <span className="rounded-lg border border-m3-info bg-m3-info-container px-3 py-1.5 font-bold text-m3-info">
            {paginaActual}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={paginaActual >= totalPages}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}

interface CasoRowProps {
  caso: CasoPruebaListItem;
  badgeTone: StatusBadgeTone;
  badgeClassName?: string;
  badgeLabel: string;
  canEdit: boolean;
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
}

/** Estado + fetch de "Ejecutar" compartido entre la fila de tabla y la
 *  tarjeta móvil — cada una monta su propia instancia (solo una es visible
 *  a la vez vía CSS), así que no hay conflicto de estado entre ambas. */
function useEjecutarCaso(caso: CasoPruebaListItem) {
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

  return { running, error, handleEjecutar };
}

interface AccionesCasoProps {
  caso: CasoPruebaListItem;
  canEdit: boolean;
  running: boolean;
  error: string | null;
  onEjecutar: () => void;
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
}

function AccionesCaso({ caso, canEdit, running, error, onEjecutar, onEdit, onDelete }: AccionesCasoProps) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        className="hover:text-m3-success"
        onClick={(e) => {
          e.stopPropagation();
          onEjecutar();
        }}
        disabled={running}
        aria-label={`Ejecutar caso ${caso.codigo}`}
        title={running ? "Lanzando…" : "Ejecutar"}
      >
        {running ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        ) : (
          <span className="material-symbols-outlined text-[20px]">play_arrow</span>
        )}
      </Button>
      {canEdit && (
        <Link
          href={`/casos/${caso.id}?editarScript=1`}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Editar script de ${caso.codigo}`}
          title="Editar script"
          data-testid="editar-script-row-action"
          className="rounded-lg p-2 text-m3-on-surface-variant transition hover:bg-m3-surface-container-high hover:text-m3-primary"
        >
          <span className="material-symbols-outlined text-[20px]">code</span>
        </Link>
      )}
      {canEdit && onEdit && (
        <Button
          variant="ghost"
          className="hover:text-m3-primary"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(caso);
          }}
          aria-label="Editar"
          title="Editar"
        >
          <span className="material-symbols-outlined text-[20px]">edit</span>
        </Button>
      )}
      {canEdit && onDelete && (
        <Button
          variant="ghost"
          className="hover:bg-m3-danger-container hover:text-m3-error"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(caso);
          }}
          aria-label="Eliminar"
          title="Eliminar"
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
        </Button>
      )}
      {error && <span className="font-label text-label-sm text-m3-error">{error}</span>}
    </div>
  );
}

function CasoRow({ caso, badgeTone, badgeClassName, badgeLabel, canEdit, onEdit, onDelete }: CasoRowProps) {
  const { running, error, handleEjecutar } = useEjecutarCaso(caso);

  function handleRowClick() {
    if (caso.ultimaEjecucionId) {
      window.location.href = `/ejecuciones/${caso.ultimaEjecucionId}`;
    }
  }

  const hasEjecucion = !!caso.ultimaEjecucionId;

  return (
    <tr
      className={`group hover:bg-m3-surface-container-high${hasEjecucion ? " cursor-pointer" : ""}`}
      onClick={handleRowClick}
    >
      <td className="px-5 py-3">
        <Link
          href={`/casos/${caso.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono-code text-mono-code text-m3-on-surface hover:text-m3-secondary hover:underline"
        >
          {caso.codigo}
        </Link>
      </td>
      <td className="px-5 py-3">
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
      <td className="px-5 py-3 font-body text-body-sm text-m3-on-surface-variant">
        {caso.responsableEmail}
      </td>
      <td className="px-5 py-3">
        <StatusBadge tone={badgeTone} className={badgeClassName}>
          {badgeLabel}
        </StatusBadge>
      </td>
      <td className="px-5 py-3 font-body text-body-sm text-m3-on-surface-variant">
        {formatDate(caso.fechaUltimaEjecucion)}
      </td>
      <td className="px-5 py-3">
        <AccionesCaso
          caso={caso}
          canEdit={canEdit}
          running={running}
          error={error}
          onEjecutar={handleEjecutar}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
}

function CasoCard({ caso, badgeTone, badgeClassName, badgeLabel, canEdit, onEdit, onDelete }: CasoRowProps) {
  const { running, error, handleEjecutar } = useEjecutarCaso(caso);
  const hasEjecucion = !!caso.ultimaEjecucionId;

  function handleCardClick() {
    if (caso.ultimaEjecucionId) {
      window.location.href = `/ejecuciones/${caso.ultimaEjecucionId}`;
    }
  }

  return (
    <div
      className={`flex flex-col gap-2.5 p-4 ${hasEjecucion ? "cursor-pointer active:bg-m3-surface-container-high" : ""}`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/casos/${caso.id}`}
            onClick={(e) => e.stopPropagation()}
            className="font-mono-code text-mono-code text-m3-on-surface-variant hover:text-m3-secondary hover:underline"
          >
            {caso.codigo}
          </Link>
          <Link
            href={`/casos/${caso.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate font-body text-body-md font-semibold text-m3-on-surface hover:text-m3-secondary hover:underline"
          >
            {caso.nombre}
          </Link>
        </div>
        <StatusBadge tone={badgeTone} className={`shrink-0 ${badgeClassName ?? ""}`}>
          {badgeLabel}
        </StatusBadge>
      </div>

      {caso.parentCaseCodigo && (
        <div className="font-label text-label-sm text-m3-secondary">
          Requiere {caso.parentCaseCodigo}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-body-sm text-m3-on-surface-variant">
        <span>{caso.responsableEmail}</span>
        <span>·</span>
        <span>{ORIGEN_LABEL[caso.origen]}</span>
        <span>·</span>
        <span>{formatDate(caso.fechaUltimaEjecucion)}</span>
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-m3-outline-variant pt-2.5">
        <span className="font-label text-label-sm text-m3-on-surface-variant">Acciones</span>
        <AccionesCaso
          caso={caso}
          canEdit={canEdit}
          running={running}
          error={error}
          onEjecutar={handleEjecutar}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
