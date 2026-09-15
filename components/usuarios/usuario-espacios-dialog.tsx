"use client";

/**
 * Gestión de espacios que administra un usuario — la contraparte
 * usuario-céntrica de `components/espacios/admins-dialog.tsx` (que es
 * espacio-céntrica). Solo aplica a usuarios con rol admin. Reemplaza el
 * conjunto completo de espacios asignados de una sola vez (checklist +
 * Guardar), a diferencia de AdminsDialog que asigna/quita de a uno.
 */
import { useEffect, useRef, useState } from "react";
import type { EspacioAsignado } from "@/types/usuario";

interface EspacioOption {
  id: string;
  nombre: string;
  color: string;
}

interface UsuarioEspaciosDialogProps {
  usuarioId: string;
  usuarioEmail: string;
  onClose: () => void;
  onChanged: (espacios: EspacioAsignado[]) => void;
}

export function UsuarioEspaciosDialog({ usuarioId, usuarioEmail, onClose, onChanged }: UsuarioEspaciosDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [todosEspacios, setTodosEspacios] = useState<EspacioOption[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    let cancelled = false;

    async function cargar() {
      setLoading(true);
      setError(null);
      try {
        const [resTodos, resAsignados] = await Promise.all([
          fetch("/api/espacios"),
          fetch(`/api/usuarios/${usuarioId}/espacios`),
        ]);
        if (!resTodos.ok) throw new Error("No se pudieron cargar los espacios");
        const todos: EspacioOption[] = await resTodos.json();
        if (cancelled) return;
        setTodosEspacios(todos);

        if (resAsignados.ok) {
          const dataAsignados = await resAsignados.json();
          const asignados: EspacioAsignado[] = dataAsignados.espacios ?? [];
          if (!cancelled) setSeleccionados(new Set(asignados.map((e) => e.id)));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    cargar();

    return () => {
      cancelled = true;
    };
  }, [usuarioId]);

  function toggle(espacioId: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(espacioId)) next.delete(espacioId);
      else next.add(espacioId);
      return next;
    });
  }

  async function handleGuardar() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${usuarioId}/espacios`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ espacioIds: Array.from(seleccionados) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "No se pudo guardar la asignación");
      }
      const data = await res.json();
      onChanged(data.espacios ?? []);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) handleClose();
      }}
      onClose={onClose}
      className="rounded-lg border border-m3-outline-variant bg-m3-surface-container-lowest p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="max-h-[85vh] w-96 max-w-full overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-headline text-headline-md text-m3-primary">Espacios asignados</h3>
          <button
            onClick={handleClose}
            className="rounded p-1 text-m3-on-surface-variant hover:bg-m3-surface-container-high hover:text-m3-on-surface"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 font-body text-body-sm text-m3-on-surface-variant">{usuarioEmail}</p>

        {error && (
          <div className="mb-3 rounded border border-m3-error bg-red-50 px-3 py-2 text-sm text-m3-error">{error}</div>
        )}

        {loading ? (
          <p className="font-body text-body-sm text-m3-on-surface-variant">Cargando…</p>
        ) : (
          <>
            <ul className="scroll-hidden mb-4 flex max-h-64 flex-col gap-1 overflow-y-auto">
              {todosEspacios.length === 0 && (
                <li className="font-body text-body-sm text-m3-on-surface-variant">No hay espacios creados.</li>
              )}
              {todosEspacios.map((espacio) => (
                <li key={espacio.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded px-2 py-1.5 hover:bg-m3-surface-container">
                    <input
                      type="checkbox"
                      checked={seleccionados.has(espacio.id)}
                      onChange={() => toggle(espacio.id)}
                      className="h-4 w-4 rounded border-m3-outline-variant text-m3-primary focus:ring-m3-secondary"
                    />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: espacio.color }} />
                    <span className="font-body text-body-sm text-m3-on-surface">{espacio.nombre}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="font-label text-label-md font-semibold text-m3-on-surface-variant hover:underline"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardar}
                disabled={saving}
                className="rounded bg-m3-primary px-4 py-2 font-label text-label-sm font-semibold text-m3-on-primary hover:opacity-90 disabled:opacity-40"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
