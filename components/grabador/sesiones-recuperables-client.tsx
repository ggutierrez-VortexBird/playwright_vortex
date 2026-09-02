"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  reanudable: boolean;
  proyecto: { nombre: string };
  credencial: { nombre: string } | null;
  _count: { pasos: number };
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

function statusColor(estado: string): string {
  switch (estado) {
    case "activa":
      return "var(--seal)";
    case "pausada":
      return "var(--amber)";
    case "detenida":
      return "var(--ink-2)";
    case "guardada":
      return "var(--seal)";
    case "descartada":
      return "var(--ink-3)";
    case "error":
      return "var(--stamp)";
    default:
      return "var(--ink-2)";
  }
}

export function SesionesRecuperablesClient({ sesiones }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleReanudar = useCallback(
    async (sesion: SesionView) => {
      setBusyId(sesion.id);
      setError(null);
      try {
        const res = await fetch(
          `/api/grabador/sesiones/${encodeURIComponent(sesion.id)}/reanudar`,
          { method: "POST" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? `Error ${res.status}`);
        }
        // Navegamos a la vista EN VIVO. El grabador-client rehidrata
        // desde server (lee token persistido) y se suscribe al WS —
        // si el worker sigue vivo, retoma el BrowserContext.
        router.push(`/casos/grabar/${sesion.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al reanudar");
      } finally {
        setBusyId(null);
      }
    },
    [router],
  );

  const handleDescartar = useCallback(
    async (sesion: SesionView) => {
      const ok = window.confirm(
        `¿Descartar la sesión "${sesion.nombre}"? Se eliminarán los ${sesion._count.pasos} paso(s) capturado(s).`,
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
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <table className="w-full text-sm" data-testid="sesiones-recuperables-table">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <th className="px-4 py-3">Sesión</th>
            <th className="px-4 py-3">Proyecto</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Pasos</th>
            <th className="px-4 py-3">Actualizada</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sesiones.map((s) => (
            <tr
              key={s.id}
              className="border-b border-gray-100 last:border-b-0"
              data-testid="sesion-row"
              data-sesion-estado={s.estado}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{s.nombre}</div>
                <div className="text-xs text-gray-500 truncate max-w-xs">
                  {s.urlInicial}
                </div>
                <div className="text-xs text-gray-400">
                  {s.ambiente} · {s.navegador}
                  {s.credencial ? ` · ${s.credencial.nombre}` : ""}
                </div>
                {s.mensajeError && (
                  <div
                    className="text-xs text-red-600 mt-1"
                    data-testid="sesion-mensaje-error"
                  >
                    {s.mensajeError}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-gray-700">{s.proyecto.nombre}</td>
              <td className="px-4 py-3">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={{
                    color: statusColor(s.estado),
                    border: `1px solid ${statusColor(s.estado)}`,
                  }}
                  data-testid="sesion-estado-badge"
                >
                  {statusLabel(s.estado)}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-700">{s._count.pasos}</td>
              <td
                className="px-4 py-3 text-gray-500"
                title={new Date(s.updatedAt).toLocaleString("es-ES")}
              >
                {formatRelative(s.updatedAt)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  {s.reanudable && (
                    <button
                      type="button"
                      onClick={() => handleReanudar(s)}
                      disabled={busyId === s.id}
                      data-testid="sesion-reanudar-button"
                      className="btn btn-primary"
                      title="Reanudar grabación (HU-GR-2)"
                    >
                      <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                      {busyId === s.id ? "Reanudando…" : "Reanudar"}
                    </button>
                  )}
                  {s.estado !== "descartada" && (
                    <button
                      type="button"
                      onClick={() => handleDescartar(s)}
                      disabled={busyId === s.id}
                      data-testid="sesion-descartar-button"
                      className="btn"
                      title="Descartar sesión"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  )}
                  <Link
                    href={`/casos/grabar/${s.id}/revisar`}
                    className="btn"
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

      {error && (
        <div
          role="alert"
          data-testid="sesiones-error"
          className="bg-red-50 border-t border-red-200 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}