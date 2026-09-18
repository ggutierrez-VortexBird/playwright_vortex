"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";

interface SesionView {
  id: string;
  nombre: string;
  urlInicial: string;
  ambiente: string;
  navegador: string;
  estado: string;
  mensajeError: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  proyecto: { nombre: string };
  credencial: { nombre: string } | null;
  /** Cantidad de pasos que se verían en "Revisar" — calculada del
   *  specCode real, no de PasoGrabado (el grabador actual ya no escribe
   *  esas filas, así que ese conteo siempre daba 0). */
  pasosCount: number;
}

interface Props {
  sesiones: SesionView[];
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const day = Math.round(hr / 24);
  if (day < 30) return `hace ${day} d`;
  return d.toLocaleDateString("es-ES");
}

function statusLabel(estado: string): string {
  switch (estado) {
    case "activa":
      return "Activa";
    case "pausada":
      return "Pausada";
    case "detenida":
      return "Detenida (recuperable)";
    case "guardada":
      return "Guardada";
    case "descartada":
      return "Descartada";
    case "error":
      return "Error";
    default:
      return estado;
  }
}

// Paridad con el precedente ya establecido en ejecucion-status.tsx:
// "en curso" → warning (ámbar, como "corriendo"), "en espera" → info (azul,
// como "pendiente"), resultado guardado → success, detenida/descartada →
// neutral (recuperable o descartada, no es un fallo), error → error.
function statusTone(estado: string): StatusBadgeTone {
  switch (estado) {
    case "activa":
      return "warning";
    case "pausada":
      return "info";
    case "guardada":
      return "success";
    case "error":
      return "error";
    case "detenida":
    case "descartada":
    default:
      return "neutral";
  }
}

export function SesionesRecuperablesClient({ sesiones }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDescartar = useCallback(
    async (sesion: SesionView) => {
      const ok = window.confirm(
        `¿Descartar la sesión "${sesion.nombre}"? Se eliminarán los ${sesion.pasosCount} paso(s) capturado(s).`,
      );
      if (!ok) return;
      setBusyId(sesion.id);
      setError(null);
      try {
        const res = await fetch(
          `/api/grabador/sesiones/${encodeURIComponent(sesion.id)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          throw new Error(`Error ${res.status}`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al descartar");
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  if (sesiones.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest shadow-card">
      {/* Tabla — md y superior */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full font-body text-body-sm" data-testid="sesiones-recuperables-table">
          <thead className="border-b border-m3-outline-variant bg-m3-surface-container">
            <tr className="text-left font-label text-label-sm font-semibold text-m3-on-surface-variant">
              <th className="px-5 py-3">Sesión</th>
              <th className="px-5 py-3">Proyecto</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3">Pasos</th>
              <th className="px-5 py-3">Actualizada</th>
              <th className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-m3-outline-variant">
            {sesiones.map((s) => (
              <tr
                key={s.id}
                data-testid="sesion-row"
                data-sesion-estado={s.estado}
                className="hover:bg-m3-surface-container-high"
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-m3-on-surface">{s.nombre}</div>
                  <div className="max-w-xs truncate text-m3-on-surface-variant">
                    {s.urlInicial}
                  </div>
                  <div className="text-m3-on-surface-variant/70">
                    {s.ambiente} · {s.navegador}
                    {s.credencial ? ` · ${s.credencial.nombre}` : ""}
                  </div>
                  {s.mensajeError && (
                    <div
                      className="mt-1 text-m3-error"
                      data-testid="sesion-mensaje-error"
                    >
                      {s.mensajeError}
                    </div>
                  )}
                </td>
                <td className="px-5 py-3 text-m3-on-surface-variant">{s.proyecto.nombre}</td>
                <td className="px-5 py-3">
                  <StatusBadge tone={statusTone(s.estado)} data-testid="sesion-estado-badge">
                    {statusLabel(s.estado)}
                  </StatusBadge>
                </td>
                <td className="px-5 py-3 text-m3-on-surface-variant">{s.pasosCount}</td>
                <td
                  className="px-5 py-3 text-m3-on-surface-variant"
                  title={new Date(s.updatedAt).toLocaleString("es-ES")}
                >
                  {formatRelative(s.updatedAt)}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {s.estado !== "descartada" && (
                      <button
                        type="button"
                        onClick={() => handleDescartar(s)}
                        disabled={busyId === s.id}
                        data-testid="sesion-descartar-button"
                        className="rounded p-1.5 text-m3-on-surface-variant transition-colors hover:bg-m3-error-container/20 hover:text-m3-error"
                        title="Descartar sesión"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    )}
                    <Link
                      href={`/casos/grabar/${s.id}/revisar`}
                      className="rounded p-1.5 text-m3-on-surface-variant transition-colors hover:bg-m3-surface-container-high hover:text-m3-primary"
                      data-testid="sesion-revisar-link"
                      title="Revisar pasos capturados"
                    >
                      <span className="material-symbols-outlined text-[16px]">visibility</span>
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — móvil */}
      <div className="flex flex-col divide-y divide-m3-outline-variant md:hidden">
        {sesiones.map((s) => (
          <div key={s.id} data-testid="sesion-card" data-sesion-estado={s.estado} className="flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-m3-on-surface">{s.nombre}</p>
                <p className="truncate text-m3-on-surface-variant">{s.urlInicial}</p>
              </div>
              <StatusBadge tone={statusTone(s.estado)} className="shrink-0">
                {statusLabel(s.estado)}
              </StatusBadge>
            </div>
            <div className="text-m3-on-surface-variant/70">
              {s.ambiente} · {s.navegador}
              {s.credencial ? ` · ${s.credencial.nombre}` : ""}
            </div>
            {s.mensajeError && <div className="text-m3-error">{s.mensajeError}</div>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-m3-on-surface-variant">
              <span>{s.pasosCount} paso{s.pasosCount === 1 ? "" : "s"}</span>
              <span title={new Date(s.updatedAt).toLocaleString("es-ES")}>
                Actualizada {formatRelative(s.updatedAt)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 border-t border-m3-outline-variant pt-2">
              {s.estado !== "descartada" && (
                <button
                  type="button"
                  onClick={() => handleDescartar(s)}
                  disabled={busyId === s.id}
                  data-testid="sesion-descartar-button-mobile"
                  className="rounded p-2 text-m3-on-surface-variant transition-colors hover:bg-m3-error-container/20 hover:text-m3-error"
                  title="Descartar sesión"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              )}
              <Link
                href={`/casos/grabar/${s.id}/revisar`}
                className="rounded p-2 text-m3-on-surface-variant transition-colors hover:bg-m3-surface-container-high hover:text-m3-primary"
                data-testid="sesion-revisar-link-mobile"
                title="Revisar pasos capturados"
              >
                <span className="material-symbols-outlined text-[18px]">visibility</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          data-testid="sesiones-error"
          className="border-t border-m3-error/30 bg-m3-error-container/10 px-4 py-3 font-body text-body-sm text-m3-error"
        >
          {error}
        </div>
      )}
    </div>
  );
}