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

function getEstadoPill(estado: CasoPruebaListItem["estado"], primerPasoFallidoNumero?: number | null) {
  const map: Record<
    CasoPruebaListItem["estado"],
    { label: string; variant: string; tone: string }
  > = {
    "sin ejecuciones": {
      label: "Sin ejecutar",
      variant: "p-idle",
      tone: "var(--ink-3)",
    },
    paso: {
      label: "Aprobado",
      variant: "p-pass",
      tone: "var(--seal)",
    },
    fallo: {
      label: primerPasoFallidoNumero != null
        ? `Falló en el paso ${primerPasoFallidoNumero}`
        : "Falló",
      variant: "p-fail",
      tone: "var(--stamp)",
    },
    reparado: {
      label: "Reparado",
      variant: "p-heal",
      tone: "var(--amber)",
    },
    errorMotor: {
      label: "Error motor",
      variant: "p-idle",
      tone: "var(--client)",
    },
  };
  // Fallback for unknown estados (e.g. "pendiente", "corriendo") coming from
  // legacy rows, API/DB drift, or future states not yet mapped. Without this
  // guard, reading `pill.classes` (now `pill.variant`) would throw
  // "Cannot read properties of undefined".
  return map[estado] ?? {
    label: estado,
    variant: "p-idle",
    tone: "var(--ink-3)",
  };
}

export function CasoTable({ casos, onEdit, onDelete, canEdit = false }: CasoTableProps) {
  if (casos.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-ink-3">No hay casos de prueba</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <table className="table-mockup">
        <thead>
          <tr>
            <th>Código</th>
            <th>Nombre</th>
            <th>Responsable</th>
            <th>Script</th>
            <th>Estado</th>
            <th>Última ejecución</th>
            <th>Pasos</th>
            <th className="text-right">Ejecutar</th>
            {canEdit && <th className="text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {casos.map((caso) => {
            const pill = getEstadoPill(caso.estado, caso.primerPasoFallidoNumero);
            return (
              <CasoRow
                key={caso.id}
                caso={caso}
                pillVariant={pill.variant}
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
  pillVariant: string;
  pillLabel: string;
  canEdit: boolean;
  onEdit?: (caso: CasoPruebaListItem) => void;
  onDelete?: (caso: CasoPruebaListItem) => void;
}

function CasoRow({ caso, pillVariant, pillLabel, canEdit, onEdit, onDelete }: CasoRowProps) {
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
      className={`group${hasEjecucion ? ' cursor-pointer hover:bg-rule-soft' : ''}`}
      onClick={handleRowClick}
    >
      <td>
        <div className="tmeta">{caso.codigo}</div>
      </td>
      <td>
        <div className="tname">{caso.nombre}</div>
      </td>
      <td>
        <div className="tmeta">{caso.responsableEmail}</div>
      </td>
      <td>
        <div className="tmeta" title={caso.scriptFileName || undefined}>
          {truncateFileName(caso.scriptFileName)}
        </div>
      </td>
      <td>
        <span className={`pill ${pillVariant}`}>{pillLabel}</span>
      </td>
      <td>
        <div className="tmeta">{formatDate(caso.fechaUltimaEjecucion)}</div>
      </td>
      <td>
        <div className="tmeta">{caso.pasosCount ?? 0}</div>
      </td>
      <td>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEjecutar();
            }}
            disabled={running}
            aria-label={`Ejecutar caso ${caso.codigo}`}
            className="btn"
            style={{
              borderColor: "var(--client)",
              color: "var(--client)",
              padding: "4px 10px",
              fontSize: 12,
            }}
          >
            {running ? "Lanzando…" : "Ejecutar"}
          </button>
          {error && <span className="tmeta" style={{ color: "var(--stamp)" }}>{error}</span>}
        </div>
      </td>
      {canEdit && (
        <td>
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
